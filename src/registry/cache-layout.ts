const path = require('node:path');

const { REGISTRY_CACHE_FILE_NAMES } = require('./constants');

import type { RegistryCacheLayout, RegistryCacheSlotPaths } from '../types/registry';

function createRegistryCacheLayout(cacheDir: string): RegistryCacheLayout {
    const rootDir = path.resolve(cacheDir);

    return {
        rootDir,
        manifestPath: path.join(rootDir, REGISTRY_CACHE_FILE_NAMES.manifest),
        bundlePath: path.join(rootDir, REGISTRY_CACHE_FILE_NAMES.bundle),
        previousManifestPath: path.join(rootDir, REGISTRY_CACHE_FILE_NAMES.previousManifest),
        previousBundlePath: path.join(rootDir, REGISTRY_CACHE_FILE_NAMES.previousBundle)
    };
}

function getRegistryCacheSlotPaths(layout: RegistryCacheLayout, slot: 'current' | 'previous' = 'current'): RegistryCacheSlotPaths {
    if (slot === 'previous') {
        return {
            manifestPath: layout.previousManifestPath,
            bundlePath: layout.previousBundlePath
        };
    }

    return {
        manifestPath: layout.manifestPath,
        bundlePath: layout.bundlePath
    };
}

module.exports = {
    createRegistryCacheLayout,
    getRegistryCacheSlotPaths
};
