const path = require('path');

const { REGISTRY_CACHE_FILE_NAMES } = require('./constants');

function createRegistryCacheLayout(cacheDir) {
    const rootDir = path.resolve(cacheDir);

    return {
        rootDir,
        manifestPath: path.join(rootDir, REGISTRY_CACHE_FILE_NAMES.manifest),
        bundlePath: path.join(rootDir, REGISTRY_CACHE_FILE_NAMES.bundle),
        previousManifestPath: path.join(rootDir, REGISTRY_CACHE_FILE_NAMES.previousManifest),
        previousBundlePath: path.join(rootDir, REGISTRY_CACHE_FILE_NAMES.previousBundle)
    };
}

function getRegistryCacheSlotPaths(layout, slot = 'current') {
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
