const path = require('node:path');

const { createRunId } = require('./run-id');

import type { ArbiterProfile, DeepCheckMode, DependencyValidationMode, OutputPolicy, ProbeMode, RegistryMode, RunMode, ValidationMode } from '../types/config';
import type { InstanceInputKind, InstanceSource } from '../types/intake';
import type { JavaProfileId, RuntimeTopologyId } from '../types/topology';
import type { RunContext } from '../types/run';

interface CreateRunContextOptions {
    inputPath: string;
    instancePath?: string;
    modsPath?: string;
    inputKind?: InstanceInputKind;
    instanceSource?: InstanceSource;
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
    javaProfile?: JavaProfileId;
    preferredRuntimeTopologyId?: RuntimeTopologyId | null;
    validationSaveArtifacts?: boolean;
    installServerCore?: boolean;
    probeMode?: ProbeMode;
    probeTimeoutMs?: number;
    probeKnowledgePath?: string;
    probeMaxMods?: number;
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
    instancePath = inputPath,
    modsPath = inputPath,
    inputKind = 'instance',
    instanceSource = 'direct',
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
    javaProfile = 'auto',
    preferredRuntimeTopologyId = null,
    validationSaveArtifacts = false,
    installServerCore = false,
    probeMode = 'auto',
    probeTimeoutMs = 12000,
    probeKnowledgePath = path.join(process.cwd(), 'data', 'probe-knowledge.json'),
    probeMaxMods = 8,
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
    const buildInternalDir = path.join(buildDir, '.cmpts');
    const reportDir = path.join(reportRootDir, runId);
    const resolvedTmpRootDir = tmpRootDir || path.join(process.cwd(), 'tmp');
    const validationSandboxRootDir = path.join(resolvedTmpRootDir, 'validation');
    const workspaceStashDir = path.join(buildInternalDir, 'stash');
    const workspaceStashModsDir = path.join(workspaceStashDir, 'mods');
    const workspaceCoreCacheDir = path.join(buildInternalDir, 'core-cache');

    return {
        runId,
        runIdPrefix,
        serverDirName: resolvedServerDirName,
        startedAt,
        inputPath,
        instancePath,
        modsPath,
        inputKind,
        instanceSource,
        outputRootDir,
        reportRootDir,
        tmpRootDir: resolvedTmpRootDir,
        outputPolicy,
        buildDir,
        buildModsDir,
        buildInternalDir,
        workspaceManifestPath: path.join(buildInternalDir, 'workspace-manifest.json'),
        workspaceStashDir,
        workspaceStashModsDir,
        workspaceCoreCacheDir,
        validationSandboxRootDir,
        reportDir,
        jsonReportPath: path.join(reportDir, 'report.json'),
        runMetadataPath: path.join(reportDir, 'run.json'),
        summaryPath: path.join(reportDir, 'summary.md'),
        eventsLogPath: path.join(reportDir, 'events.log'),
        recipePath: path.join(reportDir, 'recipe.json'),
        candidatesPath: path.join(reportDir, 'candidates.json'),
        dryRun,
        mode: resolvedMode,
        dependencyValidationMode,
        arbiterProfile,
        deepCheckMode,
        validationMode,
        validationTimeoutMs,
        validationEntrypointPath,
        javaProfile,
        preferredRuntimeTopologyId,
        validationSaveArtifacts,
        installServerCore,
        probeMode,
        probeTimeoutMs,
        probeKnowledgePath,
        probeMaxMods,
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
