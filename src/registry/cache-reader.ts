const fs = require('node:fs');

const { RegistryCacheError } = require('../core/errors');
const { parseRegistryBundleBuffer, validateBundleAgainstManifest, verifyBundleChecksum } = require('./bundle');
const { getRegistryCacheSlotPaths } = require('./cache-layout');
const { parseRegistryManifestText } = require('./manifest');

import type { CachedRegistrySnapshot, RegistryCacheLayout, RegistryCacheSlotPaths, RegistryRuntimeIssue } from '../types/registry';

function hasCacheSlot(slotPaths: RegistryCacheSlotPaths): boolean {
    return fs.existsSync(slotPaths.manifestPath) && fs.existsSync(slotPaths.bundlePath);
}

function readCachedRegistrySlot(layout: RegistryCacheLayout, slot: 'current' | 'previous' = 'current'): CachedRegistrySnapshot | null {
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

function readCachedRegistry(
    layout: RegistryCacheLayout,
    { record = () => {} }: { record?: (level: string, kind: string, message: string) => void } = {}
): {
    snapshot: CachedRegistrySnapshot | null;
    errors: RegistryRuntimeIssue[];
} {
    const errors: RegistryRuntimeIssue[] = [];

    for (const slot of ['current', 'previous'] as const) {
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
            const registryError = error as Error & { code?: string };
            const serialized: RegistryRuntimeIssue = {
                code: registryError.code || 'REGISTRY_CACHE_ERROR',
                message: registryError.message,
                slot
            };

            errors.push(serialized);
            record('error', 'registry-error', `Ошибка чтения registry cache (${slot}): ${registryError.message}`);
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
