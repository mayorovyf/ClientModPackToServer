const fs = require('node:fs');

import type { WorkspaceManifest } from '../types/workspace';
import type { ServerCoreType } from './types';

export function createServerCoreCacheKey({
    coreType,
    minecraftVersion,
    loaderVersion
}: {
    coreType: ServerCoreType;
    minecraftVersion: string | null;
    loaderVersion: string | null;
}): string {
    return [
        coreType,
        minecraftVersion || 'unknown-minecraft',
        loaderVersion || 'auto-loader'
    ].join(':');
}

export function canReuseWorkspaceServerCore({
    manifest,
    coreType,
    minecraftVersion,
    loaderVersion
}: {
    manifest: WorkspaceManifest | null | undefined;
    coreType: ServerCoreType;
    minecraftVersion: string | null;
    loaderVersion: string | null;
}): boolean {
    const expectedCacheKey = createServerCoreCacheKey({
        coreType,
        minecraftVersion,
        loaderVersion
    });

    return Boolean(
        manifest?.coreInstall
        && manifest.coreInstall.cacheKey === expectedCacheKey
        && manifest.coreInstall.entrypointPath
        && fs.existsSync(manifest.coreInstall.entrypointPath)
    );
}

module.exports = {
    canReuseWorkspaceServerCore,
    createServerCoreCacheKey
};
