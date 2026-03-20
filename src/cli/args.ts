const { RunConfigurationError } = require('../core/errors');

import type { CliOptions } from '../types/config';

type ValueFlag =
    | '--input'
    | '--output'
    | '--server-dir-name'
    | '--report-dir'
    | '--run-id-prefix'
    | '--mode'
    | '--registry-file'
    | '--registry-overrides'
    | '--registry-mode'
    | '--registry-manifest-url'
    | '--registry-bundle-url'
    | '--profile'
    | '--deep-check'
    | '--validation'
    | '--validation-timeout-ms'
    | '--validation-entrypoint'
    | '--probe'
    | '--probe-timeout-ms'
    | '--probe-knowledge'
    | '--probe-max-mods';

type MultiValueFlag = '--engine' | '--disable-engine';
type BooleanFlag = '--dry-run' | '--help' | '--validation-save-artifacts';

interface ParsedCliOptions {
    inputPath: string | null;
    outputPath: string | null;
    serverDirName: string | null;
    reportDir: string | null;
    runIdPrefix: string | null;
    mode: CliOptions['mode'];
    registryFilePath: string | null;
    registryOverridesPath: string | null;
    registryMode: CliOptions['registryMode'];
    registryManifestUrl: string | null;
    registryBundleUrl: string | null;
    arbiterProfile: CliOptions['arbiterProfile'];
    deepCheckMode: CliOptions['deepCheckMode'];
    validationMode: CliOptions['validationMode'];
    validationTimeoutMs: string | null;
    validationEntrypointPath: string | null;
    validationSaveArtifacts: boolean;
    probeMode: CliOptions['probeMode'];
    probeTimeoutMs: string | null;
    probeKnowledgePath: string | null;
    probeMaxMods: string | null;
    engineNames: string[];
    disabledEngineNames: string[];
    dryRun: boolean;
    help: boolean;
}

const VALUE_FLAGS = new Set<ValueFlag>([
    '--input',
    '--output',
    '--server-dir-name',
    '--report-dir',
    '--run-id-prefix',
    '--mode',
    '--registry-file',
    '--registry-overrides',
    '--registry-mode',
    '--registry-manifest-url',
    '--registry-bundle-url',
    '--profile',
    '--deep-check',
    '--validation',
    '--validation-timeout-ms',
    '--validation-entrypoint',
    '--probe',
    '--probe-timeout-ms',
    '--probe-knowledge',
    '--probe-max-mods'
]);
const MULTI_VALUE_FLAGS = new Set<MultiValueFlag>(['--engine', '--disable-engine']);
const BOOLEAN_FLAGS = new Set<BooleanFlag>(['--dry-run', '--help', '--validation-save-artifacts']);

function splitFlag(token: string): { key: string; value: string | null } {
    const eqIndex = token.indexOf('=');

    if (eqIndex === -1) {
        return { key: token, value: null };
    }

    return {
        key: token.slice(0, eqIndex),
        value: token.slice(eqIndex + 1)
    };
}

function pushMultiValues(target: string[], value: string | null | undefined): void {
    for (const item of String(value || '').split(',')) {
        const normalized = item.trim();

        if (normalized) {
            target.push(normalized);
        }
    }
}

function parseCliArgs(argv: string[] = []): ParsedCliOptions {
    const options: ParsedCliOptions = {
        inputPath: null,
        outputPath: null,
        serverDirName: null,
        reportDir: null,
        runIdPrefix: null,
        mode: null,
        registryFilePath: null,
        registryOverridesPath: null,
        registryMode: null,
        registryManifestUrl: null,
        registryBundleUrl: null,
        arbiterProfile: null,
        deepCheckMode: null,
        validationMode: null,
        validationTimeoutMs: null,
        validationEntrypointPath: null,
        validationSaveArtifacts: false,
        probeMode: null,
        probeTimeoutMs: null,
        probeKnowledgePath: null,
        probeMaxMods: null,
        engineNames: [],
        disabledEngineNames: [],
        dryRun: false,
        help: false
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];

        if (!token) {
            continue;
        }

        const { key, value } = splitFlag(token);

        if (BOOLEAN_FLAGS.has(key as BooleanFlag)) {
            if (key === '--dry-run') {
                options.dryRun = true;
            }

            if (key === '--help') {
                options.help = true;
            }

            if (key === '--validation-save-artifacts') {
                options.validationSaveArtifacts = true;
            }

            continue;
        }

        if (!VALUE_FLAGS.has(key as ValueFlag) && !MULTI_VALUE_FLAGS.has(key as MultiValueFlag)) {
            throw new RunConfigurationError(`Unknown argument: ${token}`);
        }

        const resolvedValue = value !== null ? value : argv[index + 1];

        if (!resolvedValue || resolvedValue.startsWith('--')) {
            throw new RunConfigurationError(`Argument ${key} requires a value`);
        }

        if (value === null) {
            index += 1;
        }

        if (MULTI_VALUE_FLAGS.has(key as MultiValueFlag)) {
            if (key === '--engine') {
                pushMultiValues(options.engineNames, resolvedValue);
            } else if (key === '--disable-engine') {
                pushMultiValues(options.disabledEngineNames, resolvedValue);
            }

            continue;
        }

        switch (key) {
            case '--input':
                options.inputPath = resolvedValue;
                break;
            case '--output':
                options.outputPath = resolvedValue;
                break;
            case '--server-dir-name':
                options.serverDirName = resolvedValue;
                break;
            case '--report-dir':
                options.reportDir = resolvedValue;
                break;
            case '--run-id-prefix':
                options.runIdPrefix = resolvedValue;
                break;
            case '--mode':
                options.mode = resolvedValue as ParsedCliOptions['mode'];
                break;
            case '--registry-file':
                options.registryFilePath = resolvedValue;
                break;
            case '--registry-overrides':
                options.registryOverridesPath = resolvedValue;
                break;
            case '--registry-mode':
                options.registryMode = resolvedValue as ParsedCliOptions['registryMode'];
                break;
            case '--registry-manifest-url':
                options.registryManifestUrl = resolvedValue;
                break;
            case '--registry-bundle-url':
                options.registryBundleUrl = resolvedValue;
                break;
            case '--profile':
                options.arbiterProfile = resolvedValue as ParsedCliOptions['arbiterProfile'];
                break;
            case '--deep-check':
                options.deepCheckMode = resolvedValue as ParsedCliOptions['deepCheckMode'];
                break;
            case '--validation':
                options.validationMode = resolvedValue as ParsedCliOptions['validationMode'];
                break;
            case '--validation-timeout-ms':
                options.validationTimeoutMs = resolvedValue;
                break;
            case '--validation-entrypoint':
                options.validationEntrypointPath = resolvedValue;
                break;
            case '--probe':
                options.probeMode = resolvedValue as ParsedCliOptions['probeMode'];
                break;
            case '--probe-timeout-ms':
                options.probeTimeoutMs = resolvedValue;
                break;
            case '--probe-knowledge':
                options.probeKnowledgePath = resolvedValue;
                break;
            case '--probe-max-mods':
                options.probeMaxMods = resolvedValue;
                break;
            default:
                throw new RunConfigurationError(`Argument is not supported: ${key}`);
        }
    }

    return options;
}

function printHelp(logger: { raw: (message?: string) => void }): void {
    logger.raw('Usage:');
    logger.raw('  node index.js [--input <instance-path>] [--output <build-root>] [--server-dir-name <name>] [--report-dir <dir>] [--run-id-prefix <prefix>] [--dry-run] [--mode <build|analyze>]');
    logger.raw('                [--engine <name>] [--disable-engine <name>] [--registry-file <path>] [--registry-overrides <path>]');
    logger.raw('                [--registry-mode <auto|offline|refresh|pinned>] [--registry-manifest-url <url>] [--registry-bundle-url <url>]');
    logger.raw('                [--profile <safe|balanced|aggressive>] [--deep-check <auto|off|force>]');
    logger.raw('                [--validation <off|auto|require|force>] [--validation-timeout-ms <ms>] [--validation-entrypoint <path>]');
    logger.raw('                [--probe <off|auto|force>] [--probe-timeout-ms <ms>] [--probe-knowledge <path>] [--probe-max-mods <n>]');
    logger.raw('                [--validation-save-artifacts]');
    logger.raw('  node index.js preset list');
    logger.raw('  node index.js preset save <name> [run-options]');
    logger.raw('  node index.js preset show <name-or-id>');
    logger.raw('  node index.js preset delete <name-or-id>');
    logger.raw('  node index.js preset run <name-or-id> [run-options]');
    logger.raw('  node index.js server doctor --target-dir <dir> [--launcher <path>] [--java <path>] [--jvm-args "<args>"] [--accept-eula]');
    logger.raw('  node index.js server install --target-dir <dir> --core <fabric|forge|neoforge> --minecraft <version> [--loader <version>] [--java <path>] [--accept-eula]');
    logger.raw('  node index.js server start --target-dir <dir> [--launcher <path>] [--java <path>] [--jvm-args "<args>"] [--accept-eula]');
    logger.raw('');
    logger.raw('Options:');
    logger.raw('  --input            Path to the instance dir, mods/ dir, or Prism root with minecraft/.minecraft');
    logger.raw('  --output           Root directory where server build folders are created');
    logger.raw('  --server-dir-name  Name of the final server build directory');
    logger.raw('  --report-dir       Root directory for run reports');
    logger.raw('  --run-id-prefix    Prefix for generated run identifiers and report folders');
    logger.raw('  --dry-run          Analyze only and write reports without creating build output');
    logger.raw('  --mode             build or analyze');
    logger.raw('  --engine           Enable a classification engine (repeatable)');
    logger.raw('  --disable-engine   Disable a classification engine (repeatable)');
    logger.raw('  --registry-file    Path to a local registry JSON file');
    logger.raw('  --registry-overrides Path to a local overrides JSON file');
    logger.raw('  --registry-mode    Registry runtime mode: auto, offline, refresh, or pinned');
    logger.raw('  --registry-manifest-url URL of remote manifest.json');
    logger.raw('  --registry-bundle-url Override URL of remote registry bundle');
    logger.raw('  --profile          Arbiter profile: safe, balanced, or aggressive');
    logger.raw('  --deep-check       Deep-check mode: auto, off, or force');
    logger.raw('  --validation       Validation mode: off, auto, require, or force');
    logger.raw('  --validation-timeout-ms Timeout in milliseconds for smoke-test');
    logger.raw('  --validation-entrypoint Explicit path to server launcher for smoke-test');
    logger.raw('  --validation-save-artifacts Save validation stdout/stderr artifacts into report dir');
    logger.raw('  --probe            Dedicated server probe mode: off, auto, or force');
    logger.raw('  --probe-timeout-ms Timeout in milliseconds for one probe run');
    logger.raw('  --probe-knowledge  Path to persistent probe knowledge JSON file');
    logger.raw('  --probe-max-mods   Maximum number of disputed mods to probe in one run');
    logger.raw('  --target-dir       Managed server target directory for server commands');
    logger.raw('  --core             Managed server core type: fabric, forge, or neoforge');
    logger.raw('  --minecraft        Minecraft version for server core installation');
    logger.raw('  --loader           Explicit loader/core version for managed server install');
    logger.raw('  --java             Explicit Java executable for install/start commands');
    logger.raw('  --launcher         Explicit server launcher path for managed server start/doctor');
    logger.raw('  --jvm-args         JVM arguments used for jar-based managed server launch');
    logger.raw('  --accept-eula      Write eula=true before managed server install/start');
    logger.raw('  --help             Show this help');
}

module.exports = {
    parseCliArgs,
    printHelp
};
