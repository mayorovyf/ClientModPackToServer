const { RegistryValidationError } = require('../core/errors');
const { parseRegistryBundleBuffer, validateBundleAgainstManifest, verifyBundleChecksum } = require('./bundle');
const { readCachedRegistrySlot } = require('./cache-reader');
const { activateRegistryCache } = require('./cache-writer');
const { fetchRegistryBuffer, fetchRegistryText } = require('./fetch-registry');
const { parseRegistryManifestText } = require('./manifest');

import type { RegistryCacheLayout } from '../types/registry';

interface RefreshRegistryCacheParams {
    manifestUrl: string;
    bundleUrlOverride?: string | null;
    cacheLayout: RegistryCacheLayout;
    timeoutMs?: number;
    record?: (level: string, kind: string, message: string) => void;
}

async function refreshRegistryCache({
    manifestUrl,
    bundleUrlOverride = null,
    cacheLayout,
    timeoutMs,
    record = () => {}
}: RefreshRegistryCacheParams) {
    if (!manifestUrl) {
        throw new RegistryValidationError('URL manifest.json для реестра не настроен');
    }

    record('info', 'registry-update', `Загрузка registry manifest: ${manifestUrl}`);
    const manifestText = await fetchRegistryText(manifestUrl, { timeoutMs });
    const manifest = parseRegistryManifestText(manifestText, {
        manifestUrl,
        bundleUrlOverride
    });
    const bundleUrl = bundleUrlOverride || manifest.bundleUrl;

    if (!bundleUrl) {
        throw new RegistryValidationError('После разбора manifest.json не удалось определить URL bundle');
    }

    record('info', 'registry-update', `Загрузка registry bundle: ${bundleUrl}`);
    const bundleBuffer = await fetchRegistryBuffer(bundleUrl, { timeoutMs });

    if (manifest.bundleSize !== null && manifest.bundleSize !== bundleBuffer.length) {
        throw new RegistryValidationError(
            `Размер скачанного bundle не совпадает с manifest: ${bundleBuffer.length} != ${manifest.bundleSize}`
        );
    }

    verifyBundleChecksum(bundleBuffer, manifest.bundleChecksum);

    parseRegistryBundleBuffer(bundleBuffer, {
        filePath: bundleUrl,
        sourceType: 'remote',
        sourceLabel: 'remote-registry'
    });

    activateRegistryCache(cacheLayout, {
        manifestText,
        bundleText: bundleBuffer.toString('utf8')
    });

    record('info', 'registry-cache', `Новый snapshot реестра активирован в кэше: ${cacheLayout.rootDir}`);

    const cachedSnapshot = readCachedRegistrySlot(cacheLayout, 'current');

    if (!cachedSnapshot) {
        throw new RegistryValidationError('После обновления кэша не удалось прочитать активный snapshot');
    }

    validateBundleAgainstManifest(cachedSnapshot.registry, manifest);

    return {
        manifest,
        registry: cachedSnapshot.registry,
        cacheSnapshot: cachedSnapshot,
        bundleUrl,
        manifestUrl
    };
}

module.exports = {
    refreshRegistryCache
};
