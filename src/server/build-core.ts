const path = require('node:path');

const { resolveJavaRuntimeForProfile } = require('../runtime/java-profile');
const { loadWorkspaceManifest, saveWorkspaceManifest } = require('../build/workspace-manifest');
const { removePathIfExists } = require('../build/file-transfer');
const { canReuseWorkspaceServerCore, createServerCoreCacheKey } = require('./core-cache');

import type { BuildProgressReporter } from '../types/app';
import type { BuildServerCoreInstallReport, PackRuntimeDetection } from '../types/runtime-detection';
import type { RunContext } from '../types/run';
import type { ServerCoreType } from './types';

function isPathInsideBuildDir(runContext: RunContext, targetPath: string | null | undefined): boolean {
    if (!targetPath) {
        return false;
    }

    const normalizedBuildDir = `${path.resolve(runContext.buildDir)}${path.sep}`;
    const resolvedTargetPath = path.resolve(targetPath);
    return resolvedTargetPath.startsWith(normalizedBuildDir);
}

function cleanupTrackedManagedCore({
    runContext,
    record = () => {}
}: {
    runContext: RunContext;
    record?: (level: string, kind: string, message: string) => void;
}): void {
    const workspaceManifest = loadWorkspaceManifest(runContext);
    const trackedCore = workspaceManifest.coreInstall;

    if (!trackedCore) {
        return;
    }

    for (const trackedPath of [trackedCore.entrypointPath, trackedCore.downloadedArtifactPath]) {
        if (!isPathInsideBuildDir(runContext, trackedPath)) {
            continue;
        }

        removePathIfExists(trackedPath);
        record('info', 'server-core', `Removed stale managed core artifact: ${trackedPath}`);
    }

    saveWorkspaceManifest(runContext, {
        ...workspaceManifest,
        coreInstall: null
    });
}

function normalizeString(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null;
    }

    const normalized = String(value).trim();
    return normalized ? normalized : null;
}

function extractFirstVersion(value: string | null): string | null {
    if (!value) {
        return null;
    }

    const match = value.match(/\d+\.\d+(?:\.\d+)?(?:[-+A-Za-z0-9.]*)?/);
    return match?.[0] || null;
}

const SERVER_CORE_INSTALL_MAX_ATTEMPTS = 3;
const SERVER_CORE_INSTALL_RETRY_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function isRetryableServerCoreInstallFailure(message: string): boolean {
    return /(SocketTimeoutException|Connect timed out|Read timed out|Failed to establish connection|These libraries failed to download|ECONNRESET|ETIMEDOUT|fetch failed|network error|temporar(?:y|ily)|timeout)/i.test(message);
}

export function normalizeMinecraftVersionForInstall(value: string | null): string | null {
    const normalized = normalizeString(value);

    if (!normalized) {
        return null;
    }

    if (/^\d+\.\d+(?:\.\d+)?$/.test(normalized)) {
        return normalized;
    }

    return extractFirstVersion(normalized);
}

export function normalizeLoaderVersionForInstall({
    coreType,
    loaderVersion
}: {
    coreType: ServerCoreType;
    loaderVersion: string | null;
}): string | null {
    const normalized = normalizeString(loaderVersion);

    if (!normalized) {
        return null;
    }

    if (/[<>=~^*[\], ]/.test(normalized)) {
        if (coreType === 'fabric') {
            return extractFirstVersion(normalized);
        }

        return null;
    }

    switch (coreType) {
        case 'forge':
            return /^\d+\.\d+(?:\.\d+)?-[0-9A-Za-z.+-]+$/.test(normalized) ? normalized : null;
        case 'neoforge':
            return /^\d+(?:\.\d+)+(?:[-+A-Za-z0-9.]*)?$/.test(normalized) ? normalized : null;
        case 'fabric':
        default:
            return normalized;
    }
}

function createServerCoreInstallReport({
    runContext,
    requested,
    status,
    cacheHit = null,
    coreType = null,
    minecraftVersion = null,
    loaderVersion = null,
    entrypointPath = null,
    downloadedArtifactPath = null,
    installedAt = null,
    notes = [],
    reason = null
}: {
    runContext: RunContext;
    requested: boolean;
    status: BuildServerCoreInstallReport['status'];
    cacheHit?: boolean | null;
    coreType?: ServerCoreType | null;
    minecraftVersion?: string | null;
    loaderVersion?: string | null;
    entrypointPath?: string | null;
    downloadedArtifactPath?: string | null;
    installedAt?: string | null;
    notes?: string[];
    reason?: string | null;
}): BuildServerCoreInstallReport {
    return {
        enabledByConfig: runContext.installServerCore,
        requested,
        status,
        cacheHit,
        coreType,
        minecraftVersion,
        loaderVersion,
        entrypointPath,
        downloadedArtifactPath,
        installedAt,
        notes: [...notes],
        reason
    };
}

export async function installDetectedServerCore({
    runContext,
    runtimeDetection,
    record = () => {},
    progressReporter = null
}: {
    runContext: RunContext;
    runtimeDetection: PackRuntimeDetection | null;
    record?: (level: string, kind: string, message: string) => void;
    progressReporter?: BuildProgressReporter | null;
}): Promise<BuildServerCoreInstallReport> {
    if (!runContext.installServerCore) {
        cleanupTrackedManagedCore({
            runContext,
            record
        });
        return createServerCoreInstallReport({
            runContext,
            requested: false,
            status: 'not-requested',
            reason: 'Managed server core installation is disabled by configuration'
        });
    }

    if (runContext.dryRun) {
        cleanupTrackedManagedCore({
            runContext,
            record
        });
        return createServerCoreInstallReport({
            runContext,
            requested: false,
            status: 'skipped',
            reason: 'Managed server core installation is skipped in dry-run mode'
        });
    }

    if (!runtimeDetection?.loader) {
        cleanupTrackedManagedCore({
            runContext,
            record
        });
        return createServerCoreInstallReport({
            runContext,
            requested: true,
            status: 'skipped',
            reason: 'Pack runtime loader could not be detected'
        });
    }

    if (!runtimeDetection.supportedServerCore) {
        cleanupTrackedManagedCore({
            runContext,
            record
        });
        return createServerCoreInstallReport({
            runContext,
            requested: true,
            status: 'skipped',
            reason: `Automatic managed server core installation is not available for loader ${runtimeDetection.loader}`
        });
    }

    const minecraftVersion = normalizeMinecraftVersionForInstall(runtimeDetection.minecraftVersion);

    if (!minecraftVersion) {
        cleanupTrackedManagedCore({
            runContext,
            record
        });
        return createServerCoreInstallReport({
            runContext,
            requested: true,
            status: 'skipped',
            coreType: runtimeDetection.supportedServerCore,
            reason: 'Minecraft version could not be normalized into an installable value'
        });
    }

    const coreType = runtimeDetection.supportedServerCore;
    const loaderVersion = normalizeLoaderVersionForInstall({
        coreType,
        loaderVersion: runtimeDetection.loaderVersion
    });
    const resolvedJavaRuntime = resolveJavaRuntimeForProfile(runContext.javaProfile);
    const workspaceManifest = loadWorkspaceManifest(runContext);
    const cacheKey = createServerCoreCacheKey({
        coreType,
        minecraftVersion,
        loaderVersion
    });

    if (canReuseWorkspaceServerCore({
        manifest: workspaceManifest,
        coreType,
        minecraftVersion,
        loaderVersion
    })) {
        record('info', 'server-core', `Reusing managed ${coreType} core already present in workspace ${runContext.buildDir}`);

        return createServerCoreInstallReport({
            runContext,
            requested: true,
            status: 'installed',
            cacheHit: true,
            coreType,
            minecraftVersion,
            loaderVersion,
            entrypointPath: workspaceManifest.coreInstall?.entrypointPath || null,
            installedAt: workspaceManifest.coreInstall?.installedAt || null,
            notes: [
                `Reused managed ${coreType} core from the existing workspace session`
            ]
        });
    }

    if (workspaceManifest.coreInstall) {
        cleanupTrackedManagedCore({
            runContext,
            record
        });
    }

    record('info', 'server-core', `Installing managed ${coreType} core into ${runContext.buildDir}`);
    progressReporter?.onStageActivity({
        stage: 'server-core',
        activityType: 'server-core-install',
        message: `Installing managed ${coreType} core`,
        coreType,
        minecraftVersion,
        loaderVersion
    });

    if (!resolvedJavaRuntime.available || !resolvedJavaRuntime.command) {
        cleanupTrackedManagedCore({
            runContext,
            record
        });
        return createServerCoreInstallReport({
            runContext,
            requested: true,
            status: 'failed',
            coreType,
            minecraftVersion,
            loaderVersion,
            reason: `Requested Java profile ${runContext.javaProfile} is not available in the trusted environment`
        });
    }

    try {
        const { installServerCore } = require('./core-installer');
        let result: Awaited<ReturnType<typeof installServerCore>> | null = null;
        let attempt = 0;
        let lastErrorMessage = '';

        while (attempt < SERVER_CORE_INSTALL_MAX_ATTEMPTS) {
            attempt += 1;
            progressReporter?.onStageActivity({
                stage: 'server-core',
                activityType: 'server-core-install-attempt',
                message: `Installing managed ${coreType} core (attempt ${attempt}/${SERVER_CORE_INSTALL_MAX_ATTEMPTS})`,
                coreType,
                minecraftVersion,
                loaderVersion,
                attempt,
                maxAttempts: SERVER_CORE_INSTALL_MAX_ATTEMPTS
            });

            try {
                result = await installServerCore({
                    targetDir: runContext.buildDir,
                    coreType,
                    minecraftVersion,
                    loaderVersion,
                    javaPath: resolvedJavaRuntime.command,
                    acceptEula: false
                });
                break;
            } catch (error) {
                lastErrorMessage = error instanceof Error ? error.message : String(error);
                const retryable = attempt < SERVER_CORE_INSTALL_MAX_ATTEMPTS && isRetryableServerCoreInstallFailure(lastErrorMessage);

                if (!retryable) {
                    throw error;
                }

                record(
                    'warning',
                    'server-core',
                    `Managed ${coreType} core installation hit a transient failure on attempt ${attempt}/${SERVER_CORE_INSTALL_MAX_ATTEMPTS}; retrying`
                );
                await sleep(SERVER_CORE_INSTALL_RETRY_DELAY_MS * attempt);
            }
        }

        if (!result) {
            throw new Error(lastErrorMessage || `Failed to install ${coreType} server core`);
        }

        record('success', 'server-core', `Managed ${coreType} core installed: ${result.entrypointPath || runContext.buildDir}`);
        saveWorkspaceManifest(runContext, {
            ...workspaceManifest,
            coreInstall: {
                cacheKey,
                coreType,
                minecraftVersion: result.minecraftVersion,
                loaderVersion: result.loaderVersion || loaderVersion,
                entrypointPath: result.entrypointPath,
                downloadedArtifactPath: result.downloadedArtifactPath,
                installedAt: result.installedAt
            }
        });

        return createServerCoreInstallReport({
            runContext,
            requested: true,
            status: 'installed',
            cacheHit: false,
            coreType,
            minecraftVersion: result.minecraftVersion,
            loaderVersion: result.loaderVersion || loaderVersion,
            entrypointPath: result.entrypointPath,
            downloadedArtifactPath: result.downloadedArtifactPath,
            installedAt: result.installedAt,
            notes: [
                ...result.notes,
                ...(attempt > 1 ? [`Installer succeeded after ${attempt} attempts`] : [])
            ]
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        cleanupTrackedManagedCore({
            runContext,
            record
        });
        record('error', 'server-core', `Managed server core installation failed: ${message}`);

        return createServerCoreInstallReport({
            runContext,
            requested: true,
            status: 'failed',
            cacheHit: false,
            coreType,
            minecraftVersion,
            loaderVersion,
            reason: message
        });
    }
}

module.exports = {
    installDetectedServerCore,
    normalizeLoaderVersionForInstall,
    normalizeMinecraftVersionForInstall
};
