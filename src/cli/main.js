const path = require('path');
const readline = require('readline');

const { createClassificationContext } = require('../classification/context');
const { runBuildPipeline } = require('../build/builder');
const { createRunContext } = require('../build/run-context');
const { printHelp, parseCliArgs } = require('./args');
const { printBanner } = require('./banner');
const { createRuntimeConfig } = require('../config/runtime-config');
const { AppError, UserInputError } = require('../core/errors');
const { createLogger } = require('../core/logger');
const { loadBlockList } = require('../io/block-list');
const { loadEffectiveRegistry } = require('../registry/effective-registry');
const { writeRunReports } = require('../report/writer');
const { cleanInputPath } = require('../utils/path-utils');

function promptForModsPath(logger) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        logger.raw('');
        logger.hint('Перетащите папку с модами в это окно');
        logger.hint('или введите путь вручную');
        logger.raw('');

        const prompt = logger.paint('Укажите путь до папки с модами: ', 'cyan');

        rl.question(prompt, (answer) => {
            rl.close();
            resolve(cleanInputPath(answer));
        });
    });
}

function handleCliError(error, logger) {
    if (error instanceof AppError) {
        logger.error(error.message);
    } else {
        logger.error(`Непредвиденная ошибка: ${error.message}`);
    }

    if (error && error.cause && logger.canLog('debug')) {
        logger.debug(error.cause.stack || error.cause.message);
    }
}

async function resolveInputPath(config, logger) {
    if (config.inputPath) {
        return config.inputPath;
    }

    const promptedPath = await promptForModsPath(logger);

    if (!promptedPath) {
        throw new UserInputError('Путь не указан');
    }

    return path.resolve(promptedPath);
}

async function runCli(config, logger) {
    printBanner(logger);

    const inputPath = await resolveInputPath(config, logger);
    const runContext = createRunContext({
        inputPath,
        outputRootDir: config.outputRootDir,
        reportRootDir: config.reportRootDir,
        tmpRootDir: config.tmpRootDir,
        dryRun: config.dryRun,
        mode: config.mode,
        outputPolicy: config.outputPolicy,
        runIdPrefix: config.runIdPrefix,
        dependencyValidationMode: config.dependencyValidationMode,
        arbiterProfile: config.arbiterProfile,
        deepCheckMode: config.deepCheckMode,
        validationMode: config.validationMode,
        validationTimeoutMs: config.validationTimeoutMs,
        validationEntrypointPath: config.validationEntrypointPath,
        validationSaveArtifacts: config.validationSaveArtifacts,
        registryMode: config.registryMode,
        registryManifestUrl: config.registryManifestUrl,
        registryBundleUrl: config.registryBundleUrl,
        registryCacheDir: config.registryCacheDir,
        localOverridesPath: config.localOverridesPath
    });
    const runLogger = logger.withContext(`[${runContext.runId}]`);
    const blockList = loadBlockList(config.blockListPath, runLogger);
    const registryRuntime = await loadEffectiveRegistry({
        embeddedRegistryPath: config.registryFilePath,
        embeddedRegistryRequired: config.registryFileRequired,
        localOverridesPath: config.localOverridesPath,
        cacheDir: config.registryCacheDir,
        mode: config.registryMode,
        manifestUrl: config.registryManifestUrl,
        bundleUrl: config.registryBundleUrl,
        timeoutMs: config.registryFetchTimeoutMs,
        logger: runLogger
    });
    const classificationContext = createClassificationContext({
        blockList,
        localRegistry: registryRuntime.registry,
        enabledEngines: config.enabledEngines,
        disabledEngines: config.disabledEngines
    });

    runLogger.info(`Путь: ${inputPath}`);
    runLogger.info(`Режим: ${runContext.mode}`);
    runLogger.info(`Build output: ${runContext.buildDir}`);
    runLogger.info(`Report output: ${runContext.reportDir}`);
    runLogger.info(`Engines: ${classificationContext.enabledEngines.join(', ')}`);
    runLogger.info(`Registry mode: ${runContext.registryMode}`);
    runLogger.info(`Effective registry source: ${registryRuntime.runtime.sourceDescription}`);
    runLogger.info(`Active registry version: ${registryRuntime.runtime.registryVersion}`);
    runLogger.info(`Effective registry file: ${registryRuntime.registry.filePath || 'embedded empty registry'}`);
    runLogger.info(`Dependency validation: ${runContext.dependencyValidationMode}`);
    runLogger.info(`Arbiter profile: ${runContext.arbiterProfile}`);
    runLogger.info(`Deep-check mode: ${runContext.deepCheckMode}`);
    runLogger.info(`Validation mode: ${runContext.validationMode}`);
    runLogger.info(`Validation timeout: ${runContext.validationTimeoutMs}ms`);
    runLogger.info(`Validation entrypoint: ${runContext.validationEntrypointPath || 'auto-detect'}`);

    const report = await runBuildPipeline({
        modsPath: inputPath,
        classificationContext,
        runContext,
        logger: runLogger
    });

    report.registry = registryRuntime.runtime;
    report.run.registryMode = runContext.registryMode;
    report.run.registryManifestUrl = runContext.registryManifestUrl;
    report.run.registryBundleUrl = runContext.registryBundleUrl;
    report.run.registryCacheDir = runContext.registryCacheDir;
    report.run.localOverridesPath = runContext.localOverridesPath;
    report.run.registrySource = registryRuntime.runtime.source;
    report.run.registryVersion = registryRuntime.runtime.registryVersion;
    report.run.registryFilePath = registryRuntime.registry.filePath;
    report.events = [...registryRuntime.runtime.events, ...report.events];
    report.warnings.push(
        ...registryRuntime.runtime.warnings.map((message) => ({
            fileName: null,
            source: 'registry',
            code: 'REGISTRY_WARNING',
            message
        }))
    );
    report.errors.push(
        ...registryRuntime.runtime.errors.map((error) => ({
            fileName: null,
            source: 'registry',
            code: error.code,
            message: error.message,
            fatal: false
        }))
    );

    runLogger.report('Запись артефактов запуска...');
    const reportFiles = writeRunReports(runContext, report);
    runLogger.report(`Артефакты сохранены: ${reportFiles.reportDir}`);

    runLogger.raw('');
    runLogger.success(`Отчёт JSON: ${reportFiles.jsonReportPath}`);
    runLogger.success(`Summary: ${reportFiles.summaryPath}`);

    if (runContext.dryRun) {
        runLogger.warn('Dry-run завершён: build-папка не создавалась');
    } else {
        runLogger.success(`Сборка готова: ${runContext.buildModsDir}`);
    }

    return {
        report,
        reportFiles,
        runContext
    };
}

async function main() {
    const scriptDir = path.resolve(__dirname, '..', '..');
    const cliOptions = parseCliArgs(process.argv.slice(2));
    const config = createRuntimeConfig({ scriptDir, cliOptions });
    const logger = createLogger({
        useColors: config.useColors,
        level: config.logLevel
    });

    if (cliOptions.help) {
        printBanner(logger);
        printHelp(logger);
        return;
    }

    try {
        await runCli(config, logger);
    } catch (error) {
        handleCliError(error, logger);
        process.exitCode = 1;
    }
}

module.exports = {
    handleCliError,
    main,
    promptForModsPath,
    resolveInputPath,
    runCli
};
