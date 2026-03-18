const fs = require('fs');

const { RegistryCacheError } = require('../core/errors');
const { parseRegistryBundleBuffer, validateBundleAgainstManifest, verifyBundleChecksum } = require('./bundle');
const { getRegistryCacheSlotPaths } = require('./cache-layout');
const { parseRegistryManifestText } = require('./manifest');

function hasCacheSlot(slotPaths) {
    return fs.existsSync(slotPaths.manifestPath) && fs.existsSync(slotPaths.bundlePath);
}

function readCachedRegistrySlot(layout, slot = 'current') {
    const slotPaths = getRegistryCacheSlotPaths(layout, slot);

    if (!hasCacheSlot(slotPaths)) {
        return null;
    }

    try {
        const manifestText = fs.readFileSync(slotPaths.manifestPath, 'utf8');
        const manifest = parseRegistryManifestText(manifestText, {
            allowUnresolvedBundleUrl: true
        });
        const bundleBuffer = fs.readFileSync(slotPaths.bundlePath);

        if (manifest.bundleSize !== null && bundleBuffer.length !== manifest.bundleSize) {
            throw new RegistryCacheError(
                `Размер cached bundle не совпадает с manifest: ${bundleBuffer.length} != ${manifest.bundleSize}`
            );
        }

        verifyBundleChecksum(bundleBuffer, manifest.bundleChecksum);

        const registry = parseRegistryBundleBuffer(bundleBuffer, {
            filePath: slotPaths.bundlePath,
            sourceType: 'cache',
            sourceLabel: slot === 'previous' ? 'cache-previous' : 'cache-current'
        });

        validateBundleAgainstManifest(registry, manifest);

        return {
            slot,
            manifest,
            registry,
            manifestPath: slotPaths.manifestPath,
            bundlePath: slotPaths.bundlePath
        };
    } catch (error) {
        if (error instanceof RegistryCacheError) {
            throw error;
        }

        throw new RegistryCacheError(`Не удалось прочитать cached registry (${slot})`, { cause: error });
    }
}

function readCachedRegistry(layout, { record = () => {} } = {}) {
    const errors = [];

    for (const slot of ['current', 'previous']) {
        try {
            const snapshot = readCachedRegistrySlot(layout, slot);

            if (!snapshot) {
                continue;
            }

            record('info', 'registry-cache', `Используется ${slot === 'current' ? 'активный' : 'предыдущий'} snapshot реестра из кэша`);
            return {
                snapshot,
                errors
            };
        } catch (error) {
            const serialized = {
                code: error.code || 'REGISTRY_CACHE_ERROR',
                message: error.message,
                slot
            };

            errors.push(serialized);
            record('error', 'registry-error', `Ошибка чтения registry cache (${slot}): ${error.message}`);
        }
    }

    return {
        snapshot: null,
        errors
    };
}

module.exports = {
    readCachedRegistry,
    readCachedRegistrySlot
};
