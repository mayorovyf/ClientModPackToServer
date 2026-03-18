const { RegistryValidationError } = require('../core/errors');
const { normalizeSchemaVersion } = require('./rules');

function normalizeRegistryChecksum(value) {
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

function resolveBundleUrl(bundleFile, manifestUrl) {
    if (!bundleFile) {
        return null;
    }

    try {
        return new URL(bundleFile).toString();
    } catch (error) {
        if (!manifestUrl) {
            return null;
        }

        return new URL(bundleFile, manifestUrl).toString();
    }
}

function normalizeRegistryManifest(value, {
    manifestUrl = null,
    bundleUrlOverride = null,
    allowUnresolvedBundleUrl = false
} = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new RegistryValidationError('Некорректный формат manifest.json: ожидается объект');
    }

    const schemaVersion = normalizeSchemaVersion(value.schemaVersion);
    const registryVersion = String(value.registryVersion || '').trim();

    if (!registryVersion) {
        throw new RegistryValidationError('Манифест реестра не содержит registryVersion');
    }

    const bundleFile = String(value.bundleFile || value.bundleUrl || '').trim();

    if (!bundleFile && !bundleUrlOverride) {
        throw new RegistryValidationError('Манифест реестра не содержит bundleFile');
    }

    const bundleUrl = bundleUrlOverride || resolveBundleUrl(bundleFile, manifestUrl);

    if (!bundleUrl && !allowUnresolvedBundleUrl) {
        throw new RegistryValidationError('Не удалось определить URL bundle из manifest.json');
    }

    const bundleSize = value.bundleSize === undefined || value.bundleSize === null || value.bundleSize === ''
        ? null
        : Number(value.bundleSize);

    if (bundleSize !== null && (!Number.isInteger(bundleSize) || bundleSize < 0)) {
        throw new RegistryValidationError(`Некорректный размер bundle в манифесте: ${value.bundleSize}`);
    }

    return {
        schemaVersion,
        registryVersion,
        bundleFile,
        bundleChecksum: normalizeRegistryChecksum(value.bundleChecksum),
        bundleSize,
        publishedAt: value.publishedAt ? String(value.publishedAt).trim() : null,
        source: value.source ? String(value.source).trim() : null,
        manifestUrl,
        bundleUrl
    };
}

function parseRegistryManifestText(text, options = {}) {
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
