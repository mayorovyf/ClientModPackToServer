const path = require('node:path');

const { createRunId } = require('./run-id');

import type { ArbiterProfile, DeepCheckMode, DependencyValidationMode, OutputPolicy, RegistryMode, RunMode, ValidationMode } from '../types/config';
import type { RunContext } from '../types/run';

interface CreateRunContextOptions {
    inputPath: string;
    outputRootDir: string;
    reportRootDir: string;
    tmpRootDir?: string | null;
    dryRun?: boolean;
    mode?: RunMode;
    outputPolicy?: OutputPolicy;
    runIdPrefix?: string;
    dependencyValidationMode?: DependencyValidationMode;
    arbiterProfile?: ArbiterProfile;
    deepCheckMode?: DeepCheckMode;
    validationMode?: ValidationMode;
    validationTimeoutMs?: number;
    validationEntrypointPath?: string | null;
    validationSaveArtifacts?: boolean;
    registryMode?: RegistryMode;
    registryManifestUrl?: string | null;
    registryBundleUrl?: string | null;
    registryCacheDir?: string | null;
    localOverridesPath?: string | null;
}

function createRunContext({
    inputPath,
    outputRootDir,
    reportRootDir,
    tmpRootDir = null,
    dryRun = false,
    mode = 'build',
    outputPolicy = 'unique-run-dir',
    runIdPrefix = 'run',
    dependencyValidationMode = 'conservative',
    arbiterProfile = 'balanced',
    deepCheckMode = 'auto',
    validationMode = 'auto',
    validationTimeoutMs = 15000,
    validationEntrypointPath = null,
    validationSaveArtifacts = false,
    registryMode = 'auto',
    registryManifestUrl = null,
    registryBundleUrl = null,
    registryCacheDir = null,
    localOverridesPath = null
}: CreateRunContextOptions): RunContext {
    const runId = createRunId({ prefix: runIdPrefix });
    const startedAt = new Date().toISOString();
    const resolvedMode = dryRun ? 'analyze' : mode;
    const buildDir = path.join(outputRootDir, runId);
    const buildModsDir = path.join(buildDir, 'mods');
    const reportDir = path.join(reportRootDir, runId);
    const resolvedTmpRootDir = tmpRootDir || path.join(process.cwd(), 'tmp');

    return {
        runId,
        runIdPrefix,
        startedAt,
        inputPath,
        outputRootDir,
        reportRootDir,
        tmpRootDir: resolvedTmpRootDir,
        outputPolicy,
        buildDir,
        buildModsDir,
        reportDir,
        jsonReportPath: path.join(reportDir, 'report.json'),
        runMetadataPath: path.join(reportDir, 'run.json'),
        summaryPath: path.join(reportDir, 'summary.md'),
        eventsLogPath: path.join(reportDir, 'events.log'),
        dryRun,
        mode: resolvedMode,
        dependencyValidationMode,
        arbiterProfile,
        deepCheckMode,
        validationMode,
        validationTimeoutMs,
        validationEntrypointPath,
        validationSaveArtifacts,
        registryMode,
        registryManifestUrl,
        registryBundleUrl,
        registryCacheDir,
        localOverridesPath
    };
}

module.exports = {
    createRunContext
};
