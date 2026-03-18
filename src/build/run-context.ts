const path = require('node:path');

const { createRunId } = require('./run-id');

import type { ArbiterProfile, DeepCheckMode, DependencyValidationMode, OutputPolicy, RegistryMode, RunMode, ValidationMode } from '../types/config';
import type { RunContext } from '../types/run';

interface CreateRunContextOptions {
    inputPath: string;
    modsPath?: string;
    outputRootDir: string;
    serverDirName?: string | null;
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

function deriveDefaultServerDirName(sourcePath: string): string {
    const normalizedSourcePath = path.resolve(sourcePath);
    const preferredSourcePath = path.basename(normalizedSourcePath).toLowerCase() === 'mods'
        ? path.dirname(normalizedSourcePath)
        : normalizedSourcePath;
    const baseName = path.basename(preferredSourcePath).trim() || 'server';
    const sanitized = baseName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/\.+$/g, '').trim() || 'server';
    return `${sanitized}-server`;
}

function createRunContext({
    inputPath,
    modsPath = inputPath,
    outputRootDir,
    serverDirName = null,
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
    const resolvedServerDirName = serverDirName || deriveDefaultServerDirName(inputPath);
    const buildDir = path.join(outputRootDir, resolvedServerDirName);
    const buildModsDir = path.join(buildDir, 'mods');
    const reportDir = path.join(reportRootDir, runId);
    const resolvedTmpRootDir = tmpRootDir || path.join(process.cwd(), 'tmp');

    return {
        runId,
        runIdPrefix,
        serverDirName: resolvedServerDirName,
        startedAt,
        inputPath,
        instancePath: inputPath,
        modsPath,
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
