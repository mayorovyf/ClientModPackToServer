import type { BuildServerCoreInstallReport, PackRuntimeDetection } from '../types/runtime-detection';
import type { RunContext } from '../types/run';
import type { ServerCoreType } from './types';

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
    record = () => {}
}: {
    runContext: RunContext;
    runtimeDetection: PackRuntimeDetection | null;
    record?: (level: string, kind: string, message: string) => void;
}): Promise<BuildServerCoreInstallReport> {
    if (!runContext.installServerCore) {
        return createServerCoreInstallReport({
            runContext,
            requested: false,
            status: 'not-requested',
            reason: 'Managed server core installation is disabled by configuration'
        });
    }

    if (runContext.dryRun) {
        return createServerCoreInstallReport({
            runContext,
            requested: false,
            status: 'skipped',
            reason: 'Managed server core installation is skipped in dry-run mode'
        });
    }

    if (!runtimeDetection?.loader) {
        return createServerCoreInstallReport({
            runContext,
            requested: true,
            status: 'skipped',
            reason: 'Pack runtime loader could not be detected'
        });
    }

    if (!runtimeDetection.supportedServerCore) {
        return createServerCoreInstallReport({
            runContext,
            requested: true,
            status: 'skipped',
            reason: `Automatic managed server core installation is not available for loader ${runtimeDetection.loader}`
        });
    }

    const minecraftVersion = normalizeMinecraftVersionForInstall(runtimeDetection.minecraftVersion);

    if (!minecraftVersion) {
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

    record('info', 'server-core', `Installing managed ${coreType} core into ${runContext.buildDir}`);

    try {
        const { installServerCore } = require('./core-installer');
        const result = await installServerCore({
            targetDir: runContext.buildDir,
            coreType,
            minecraftVersion,
            loaderVersion,
            acceptEula: false
        });

        record('success', 'server-core', `Managed ${coreType} core installed: ${result.entrypointPath || runContext.buildDir}`);

        return createServerCoreInstallReport({
            runContext,
            requested: true,
            status: 'installed',
            coreType,
            minecraftVersion: result.minecraftVersion,
            loaderVersion: result.loaderVersion || loaderVersion,
            entrypointPath: result.entrypointPath,
            downloadedArtifactPath: result.downloadedArtifactPath,
            installedAt: result.installedAt,
            notes: result.notes
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        record('error', 'server-core', `Managed server core installation failed: ${message}`);

        return createServerCoreInstallReport({
            runContext,
            requested: true,
            status: 'failed',
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
