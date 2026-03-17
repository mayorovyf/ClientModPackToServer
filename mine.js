const fs = require("fs");
const path = require("path");
const readline = require("readline");

const ROOT_DIR = __dirname;
const SERVER_LIST_PATH = path.join(ROOT_DIR, "server-modlist.txt");
const CLIENT_LIST_PATH = path.join(ROOT_DIR, "client-modlist.txt");
const OUTPUT_ROOT = path.join(ROOT_DIR, "modpack");

function logInfo(message) {
  console.log(`[INFO] ${message}`);
}

function logHint(message) {
  console.log(`[ПОДСКАЗКА] ${message}`);
}

function logError(message) {
  console.log(`[ОШИБКА] ${message}`);
}

function ensureFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "", "utf8");
  }
}

function loadModList(filePath) {
  ensureFileExists(filePath);

  const entries = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  const normalizedEntries = new Set();

  for (const entry of entries) {
    for (const variant of getNameVariants(entry)) {
      normalizedEntries.add(variant);
      normalizedEntries.add(toLooseKey(variant));
    }
  }

  return normalizedEntries;
}

function sanitizeFolderName(inputPath) {
  return inputPath
    .trim()
    .replace(/^"+|"+$/g, "")
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "");
}

function stripJarExtension(fileName) {
  return fileName.replace(/\.jar$/i, "");
}

function normalizeBaseName(name) {
  return stripJarExtension(path.basename(name))
    .trim()
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\([^)]+\)/g, "")
    .replace(/\s+/g, "_")
    .replace(/\+/g, "_")
    .replace(/_+/g, "_")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function isVersionLikeToken(token) {
  const cleaned = token.toLowerCase();

  return (
    /^\d/.test(cleaned) ||
    /^mc\d/.test(cleaned) ||
    /^v\d/.test(cleaned) ||
    /^\d+x$/.test(cleaned) ||
    /^\d+\.\d+/.test(cleaned) ||
    /^(alpha|beta|rc|pre|hotfix|build)\d*([._-]\d+)*$/.test(cleaned)
  );
}

function isMetadataToken(token) {
  return [
    "forge",
    "fabric",
    "neoforge",
    "neo",
    "quilt",
    "all",
    "universal",
    "release",
    "snapshot",
    "beta",
    "alpha",
    "hotfix",
    "merged",
    "build",
    "mod",
  ].includes(token);
}

function getFilteredTokens(name) {
  return normalizeBaseName(name)
    .split(/[-_]+/)
    .filter(Boolean)
    .filter((token) => !isVersionLikeToken(token) && !isMetadataToken(token));
}

function trimTrailingTokens(name, separator) {
  let current = name;

  while (true) {
    const parts = current.split(separator).filter(Boolean);
    if (parts.length <= 1) {
      return current;
    }

    const lastToken = parts[parts.length - 1];
    if (!isVersionLikeToken(lastToken) && !isMetadataToken(lastToken)) {
      return current;
    }

    parts.pop();
    current = parts.join(separator);
  }
}

function getNameVariants(name) {
  const original = normalizeBaseName(name);
  const variants = new Set([original]);

  let dashTrimmed = trimTrailingTokens(original, "-");
  let underscoreTrimmed = trimTrailingTokens(original, "_");

  variants.add(dashTrimmed);
  variants.add(underscoreTrimmed);

  if (dashTrimmed.includes("_")) {
    variants.add(trimTrailingTokens(dashTrimmed, "_"));
  }

  if (underscoreTrimmed.includes("-")) {
    variants.add(trimTrailingTokens(underscoreTrimmed, "-"));
  }

  for (const variant of Array.from(variants)) {
    variants.add(variant.replace(/[-_]?mc\d[\w.+-]*$/g, ""));
    variants.add(variant.replace(/[-_]?(forge|fabric|neoforge|neo|quilt|all|universal)$/g, ""));
  }

  const filteredTokens = getFilteredTokens(name);
  if (filteredTokens.length > 0) {
    variants.add(filteredTokens.join("-"));
    variants.add(filteredTokens.join("_"));

    if (filteredTokens.length > 1) {
      variants.add(filteredTokens[0]);
      variants.add(filteredTokens.slice(0, 2).join("-"));
      variants.add(filteredTokens.slice(0, 2).join("_"));
    }
  }

  return new Set(
    Array.from(variants)
      .map((variant) => variant.trim().replace(/^[-_]+|[-_]+$/g, ""))
      .filter(Boolean)
  );
}

function toLooseKey(name) {
  return normalizeBaseName(name).replace(/[^a-z0-9]/g, "");
}

function matchesModList(variants, modList) {
  for (const variant of variants) {
    if (modList.has(variant) || modList.has(toLooseKey(variant))) {
      return true;
    }
  }

  return false;
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function resolveModsPath(rawInput) {
  const cleaned = rawInput.trim().replace(/^"+|"+$/g, "");
  return path.resolve(cleaned);
}

function getModsPathFromArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    return null;
  }

  return path.resolve(args.join(" "));
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function clearDirectory(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

function copyFileToDirectory(sourcePath, fileName, destinationDir) {
  const destinationPath = path.join(destinationDir, fileName);
  fs.copyFileSync(sourcePath, destinationPath);
}

function categorizeMods(modFiles, serverMods, clientMods, serverOutputDir, unknownOutputDir) {
  let copiedServer = 0;
  let skippedClient = 0;
  let copiedUnknown = 0;
  const unknownModNames = [];

  for (const modFile of modFiles) {
    const variants = getNameVariants(modFile.name);

    if (matchesModList(variants, serverMods)) {
      copyFileToDirectory(modFile.fullPath, modFile.name, serverOutputDir);
      copiedServer += 1;
      continue;
    }

    if (matchesModList(variants, clientMods)) {
      skippedClient += 1;
      continue;
    }

    copyFileToDirectory(modFile.fullPath, modFile.name, unknownOutputDir);
    unknownModNames.push(modFile.name);
    copiedUnknown += 1;
  }

  return {
    copiedServer,
    skippedClient,
    copiedUnknown,
    unknownModNames,
  };
}

async function main() {
  try {
    const serverMods = loadModList(SERVER_LIST_PATH);
    const clientMods = loadModList(CLIENT_LIST_PATH);

    logInfo(`Загружено ${serverMods.size} серверных модов из ${path.basename(SERVER_LIST_PATH)}`);
    logInfo(`Загружено ${clientMods.size} клиентских модов из ${path.basename(CLIENT_LIST_PATH)}`);
    let modsDir = getModsPathFromArgs();

    if (!modsDir) {
      logHint("Перетащите папку с модами в это окно");
      logHint("или введите путь вручную");

      const input = await askQuestion("Укажите путь до папки с модами: ");
      modsDir = resolveModsPath(input);
    } else {
      logInfo(`Получен путь из аргументов: ${modsDir}`);
    }

    if (!fs.existsSync(modsDir)) {
      throw new Error(`Папка не найдена: ${modsDir}`);
    }

    if (!fs.statSync(modsDir).isDirectory()) {
      throw new Error(`Указанный путь не является папкой: ${modsDir}`);
    }

    const allEntries = fs.readdirSync(modsDir, { withFileTypes: true });
    const jarFiles = allEntries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".jar"))
      .map((entry) => ({
        name: entry.name,
        fullPath: path.join(modsDir, entry.name),
      }));

    logInfo(`Найдено ${jarFiles.length} jar-файлов в папке mods`);

    const outputFolderName = sanitizeFolderName(modsDir);
    const outputBase = path.join(OUTPUT_ROOT, outputFolderName);
    const serverOutputDir = path.join(outputBase, "server");
    const unknownOutputDir = path.join(outputBase, "unknown");
    const unknownListPath = path.join(outputBase, "unknown-mods.txt");

    ensureDirectory(outputBase);
    clearDirectory(serverOutputDir);
    clearDirectory(unknownOutputDir);
    ensureDirectory(serverOutputDir);
    ensureDirectory(unknownOutputDir);

    const result = categorizeMods(
      jarFiles,
      serverMods,
      clientMods,
      serverOutputDir,
      unknownOutputDir
    );

    fs.writeFileSync(unknownListPath, result.unknownModNames.join("\n"), "utf8");

    logInfo(`Скопировано ${result.copiedServer} модов в папку server`);
    logInfo(`Пропущено ${result.skippedClient} клиентских модов по client-modlist.txt`);
    logInfo(`Скопировано ${result.copiedUnknown} нераспознанных модов в папку unknown`);
    logInfo(`Список нераспознанных модов сохранен в: ${unknownListPath}`);
    logInfo(`Результат сохранен в: ${outputBase}`);
  } catch (error) {
    logError(error.message);
    process.exitCode = 1;
  }
}

main();
