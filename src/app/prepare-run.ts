const { createRunContext } = require('../build/run-context');
const { resolveInstanceLayout } = require('../io/instance-folder');
const { loadRuntimeState } = require('./load-runtime-state');

import type { PreparedRun, ApplicationLogger, ClassificationContextLike, RegistryRuntimeBundle } from '../types/app';
import type { RuntimeConfig } from '../types/config';
import type { RunContext } from '../types/run';

interface LogPreparedRunParams {
    inputPath: string;
    instancePath: string;
    modsPath: string;
    runContext: RunContext;
    classificationContext: ClassificationContextLike;
    registryRuntime: RegistryRuntimeBundle;
    logger: ApplicationLogger;
}

interface PrepareRunParams {
    config: RuntimeConfig;
    inputPath: string;
    logger: ApplicationLogger;
}

function logPreparedRun({
    inputPath,
    instancePath,
    modsPath,
    runContext,
    classificationContext,
    registryRuntime,
    logger
}: LogPreparedRunParams): void {
    logger.info(`Вход: ${inputPath}`);
    logger.info(`Инстанс: ${instancePath}`);
    logger.info(`Папка mods: ${modsPath}`);
    logger.info(`Режим: ${runContext.mode}`);
    logger.info(`Build output: ${runContext.buildDir}`);
    logger.info(`Report output: ${runContext.reportDir}`);
    logger.info(`Engines: ${classificationContext.enabledEngines.join(', ')}`);
    logger.info(`Registry mode: ${runContext.registryMode}`);
    logger.info(`Effective registry source: ${registryRuntime.runtime.sourceDescription}`);
    logger.info(`Active registry version: ${registryRuntime.runtime.registryVersion}`);
    logger.info(`Effective registry file: ${registryRuntime.registry.filePath || 'embedded empty registry'}`);
    logger.info(`Dependency validation: ${runContext.dependencyValidationMode}`);
    logger.info(`Arbiter profile: ${runContext.arbiterProfile}`);
    logger.info(`Deep-check mode: ${runContext.deepCheckMode}`);
    logger.info(`Validation mode: ${runContext.validationMode}`);
    logger.info(`Validation timeout: ${runContext.validationTimeoutMs}ms`);
    logger.info(`Validation entrypoint: ${runContext.validationEntrypointPath || 'auto-detect'}`);
}

async function prepareRun({ config, inputPath, logger }: PrepareRunParams): Promise<PreparedRun> {
    const instanceLayout = resolveInstanceLayout(inputPath);
    const runContext = createRunContext({
        inputPath: instanceLayout.instancePath,
        modsPath: instanceLayout.modsPath,
        outputRootDir: config.outputRootDir,
        serverDirName: config.serverDirName,
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
    }) as RunContext;
    const runLogger = logger.withContext(`[${runContext.runId}]`);
    const runtimeState = await loadRuntimeState({
        config,
        runContext,
        logger: runLogger
    });

    logPreparedRun({
        inputPath,
        instancePath: instanceLayout.instancePath,
        modsPath: instanceLayout.modsPath,
        runContext,
        classificationContext: runtimeState.classificationContext,
        registryRuntime: runtimeState.registryRuntime,
        logger: runLogger
    });

    return {
        inputPath,
        instancePath: instanceLayout.instancePath,
        modsPath: instanceLayout.modsPath,
        runContext,
        runLogger,
        ...runtimeState
    };
}

module.exports = {
    logPreparedRun,
    prepareRun
};
