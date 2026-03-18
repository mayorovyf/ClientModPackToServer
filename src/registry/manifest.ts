const { RegistryValidationError } = require('../core/errors');
const { normalizeSchemaVersion } = require('./rules');

import type { RegistryManifest } from '../types/registry';

interface NormalizeRegistryManifestOptions {
    manifestUrl?: string | null;
    bundleUrlOverride?: string | null;
    allowUnresolvedBundleUrl?: boolean;
}

function normalizeRegistryChecksum(value: unknown): string {
    const normalized = String(value || '').trim().toLowerCase();

    if (!normalized) {
        throw new RegistryValidationError('Манифест реестра не содержит bundleChecksum');
    }

    const rawValue = normalized.startsWith('sha256:') ? normalized.slice('sha256:'.length) : normalized;

    if (!/^[a-f0-9]{64}$/.test(rawValue)) {
        throw new RegistryValidationError(`Некорректный checksum bundle: ${value}`);
    }

    return rawValue;
}

function resolveBundleUrl(bundleFile: string, manifestUrl?: string | null): string | null {
    if (!bundleFile) {
        return null;
    }

    try {
        return new URL(bundleFile).toString();
    } catch {
        if (!manifestUrl) {
            return null;
        }

        return new URL(bundleFile, manifestUrl).toString();
    }
}

function normalizeRegistryManifest(
    value: unknown,
    {
        manifestUrl = null,
        bundleUrlOverride = null,
        allowUnresolvedBundleUrl = false
    }: NormalizeRegistryManifestOptions = {}
): RegistryManifest {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new RegistryValidationError('Некорректный формат manifest.json: ожидается объект');
    }

    const normalizedValue = value as Record<string, unknown>;
    const schemaVersion = normalizeSchemaVersion(normalizedValue.schemaVersion);
    const registryVersion = String(normalizedValue.registryVersion || '').trim();

    if (!registryVersion) {
        throw new RegistryValidationError('Манифест реестра не содержит registryVersion');
    }

    const bundleFile = String(normalizedValue.bundleFile || normalizedValue.bundleUrl || '').trim();

    if (!bundleFile && !bundleUrlOverride) {
        throw new RegistryValidationError('Манифест реестра не содержит bundleFile');
    }

    const bundleUrl = bundleUrlOverride || resolveBundleUrl(bundleFile, manifestUrl);

    if (!bundleUrl && !allowUnresolvedBundleUrl) {
        throw new RegistryValidationError('Не удалось определить URL bundle из manifest.json');
    }

    const bundleSize = normalizedValue.bundleSize === undefined || normalizedValue.bundleSize === null || normalizedValue.bundleSize === ''
        ? null
        : Number(normalizedValue.bundleSize);

    if (bundleSize !== null && (!Number.isInteger(bundleSize) || bundleSize < 0)) {
        throw new RegistryValidationError(`Некорректный размер bundle в манифесте: ${normalizedValue.bundleSize}`);
    }

    return {
        schemaVersion,
        registryVersion,
        bundleFile,
        bundleChecksum: normalizeRegistryChecksum(normalizedValue.bundleChecksum),
        bundleSize,
        publishedAt: normalizedValue.publishedAt ? String(normalizedValue.publishedAt).trim() : null,
        source: normalizedValue.source ? String(normalizedValue.source).trim() : null,
        manifestUrl,
        bundleUrl
    };
}

function parseRegistryManifestText(text: string, options: NormalizeRegistryManifestOptions = {}): RegistryManifest {
    try {
        return normalizeRegistryManifest(JSON.parse(String(text || '')), options);
    } catch (error) {
        if (error instanceof RegistryValidationError) {
            throw error;
        }

        throw new RegistryValidationError('Не удалось разобрать manifest.json реестра', { cause: error });
    }
}

module.exports = {
    normalizeRegistryChecksum,
    normalizeRegistryManifest,
    parseRegistryManifestText,
    resolveBundleUrl
};
