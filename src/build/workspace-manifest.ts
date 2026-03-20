const fs = require('node:fs');

const { ensureDirectory } = require('../io/history');

import type { RunContext } from '../types/run';
import type { WorkspaceManifest } from '../types/workspace';

function createEmptyWorkspaceManifest(runContext: RunContext): WorkspaceManifest {
    const now = new Date().toISOString();

    return {
        schemaVersion: 1,
        runId: runContext.runId,
        initializedAt: now,
        updatedAt: now,
        inputPath: runContext.inputPath,
        instancePath: runContext.instancePath,
        modsPath: runContext.modsPath,
        instanceSkeletonCopied: false,
        activeMods: [],
        stashedMods: [],
        eulaAccepted: false,
        coreInstall: null
    };
}

function normalizeManifest(raw: unknown, runContext: RunContext): WorkspaceManifest {
    if (!raw || typeof raw !== 'object') {
        return createEmptyWorkspaceManifest(runContext);
    }

    const manifest = raw as Partial<WorkspaceManifest>;
    const now = new Date().toISOString();

    return {
        schemaVersion: 1,
        runId: typeof manifest.runId === 'string' && manifest.runId.trim() ? manifest.runId : runContext.runId,
        initializedAt: typeof manifest.initializedAt === 'string' ? manifest.initializedAt : now,
        updatedAt: typeof manifest.updatedAt === 'string' ? manifest.updatedAt : now,
        inputPath: typeof manifest.inputPath === 'string' && manifest.inputPath.trim() ? manifest.inputPath : runContext.inputPath,
        instancePath: typeof manifest.instancePath === 'string' && manifest.instancePath.trim() ? manifest.instancePath : runContext.instancePath,
        modsPath: typeof manifest.modsPath === 'string' && manifest.modsPath.trim() ? manifest.modsPath : runContext.modsPath,
        instanceSkeletonCopied: Boolean(manifest.instanceSkeletonCopied),
        activeMods: Array.isArray(manifest.activeMods) ? [...new Set(manifest.activeMods.filter(Boolean))].sort() : [],
        stashedMods: Array.isArray(manifest.stashedMods) ? [...new Set(manifest.stashedMods.filter(Boolean))].sort() : [],
        eulaAccepted: Boolean(manifest.eulaAccepted),
        coreInstall: manifest.coreInstall && typeof manifest.coreInstall === 'object'
            ? {
                cacheKey: typeof manifest.coreInstall.cacheKey === 'string' ? manifest.coreInstall.cacheKey : null,
                coreType: typeof manifest.coreInstall.coreType === 'string' ? manifest.coreInstall.coreType : null,
                minecraftVersion: typeof manifest.coreInstall.minecraftVersion === 'string' ? manifest.coreInstall.minecraftVersion : null,
                loaderVersion: typeof manifest.coreInstall.loaderVersion === 'string' ? manifest.coreInstall.loaderVersion : null,
                entrypointPath: typeof manifest.coreInstall.entrypointPath === 'string' ? manifest.coreInstall.entrypointPath : null,
                downloadedArtifactPath: typeof manifest.coreInstall.downloadedArtifactPath === 'string' ? manifest.coreInstall.downloadedArtifactPath : null,
                installedAt: typeof manifest.coreInstall.installedAt === 'string' ? manifest.coreInstall.installedAt : null
            }
            : null
    };
}

function loadWorkspaceManifest(runContext: RunContext): WorkspaceManifest {
    if (!fs.existsSync(runContext.workspaceManifestPath)) {
        return createEmptyWorkspaceManifest(runContext);
    }

    try {
        const raw = JSON.parse(fs.readFileSync(runContext.workspaceManifestPath, 'utf8'));
        return normalizeManifest(raw, runContext);
    } catch {
        return createEmptyWorkspaceManifest(runContext);
    }
}

function saveWorkspaceManifest(runContext: RunContext, manifest: WorkspaceManifest): WorkspaceManifest {
    const normalized = normalizeManifest({
        ...manifest,
        updatedAt: new Date().toISOString()
    }, runContext);

    ensureDirectory(runContext.buildInternalDir);
    fs.writeFileSync(runContext.workspaceManifestPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
    return normalized;
}

module.exports = {
    createEmptyWorkspaceManifest,
    loadWorkspaceManifest,
    saveWorkspaceManifest
};
