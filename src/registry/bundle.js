const crypto = require('crypto');

const { RegistryValidationError } = require('../core/errors');
const { createRegistrySnapshot, normalizeRegistryDocument } = require('./rules');

function calculateRegistryChecksum(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function verifyBundleChecksum(buffer, expectedChecksum) {
    const actualChecksum = calculateRegistryChecksum(buffer);

    if (actualChecksum !== expectedChecksum) {
        throw new RegistryValidationError(`Checksum bundle не совпадает: ожидался ${expectedChecksum}, получен ${actualChecksum}`);
    }

    return actualChecksum;
}

function normalizeRegistryBundle(value, {
    filePath = null,
    sourceType = 'bundle',
    sourceLabel = 'registry-bundle'
} = {}) {
    const registry = normalizeRegistryDocument(value, {
        filePath,
        exists: true,
        defaultSource: sourceLabel,
        sourceType,
        sourceLabel
    });

    return createRegistrySnapshot({
        ...registry,
        filePath
    });
}

function parseRegistryBundleBuffer(buffer, options = {}) {
    try {
        return normalizeRegistryBundle(JSON.parse(Buffer.from(buffer).toString('utf8')), options);
    } catch (error) {
        if (error instanceof RegistryValidationError) {
            throw error;
        }

        throw new RegistryValidationError('Не удалось разобрать registry bundle', { cause: error });
    }
}

function validateBundleAgainstManifest(bundle, manifest) {
    if (bundle.registryVersion !== manifest.registryVersion) {
        throw new RegistryValidationError(
            `Версия bundle (${bundle.registryVersion}) не совпадает с manifest (${manifest.registryVersion})`
        );
    }

    if (bundle.schemaVersion !== manifest.schemaVersion) {
        throw new RegistryValidationError(
            `Версия схемы bundle (${bundle.schemaVersion}) не совпадает с manifest (${manifest.schemaVersion})`
        );
    }
}

module.exports = {
    calculateRegistryChecksum,
    normalizeRegistryBundle,
    parseRegistryBundleBuffer,
    validateBundleAgainstManifest,
    verifyBundleChecksum
};
