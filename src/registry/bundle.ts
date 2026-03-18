const crypto = require('node:crypto');

const { RegistryValidationError } = require('../core/errors');
const { createRegistrySnapshot, normalizeRegistryDocument } = require('./rules');

import type { EffectiveRegistry, RegistryManifest } from '../types/registry';

interface NormalizeRegistryBundleOptions {
    filePath?: string | null;
    sourceType?: string;
    sourceLabel?: string;
}

function calculateRegistryChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function verifyBundleChecksum(buffer: Buffer, expectedChecksum: string): string {
    const actualChecksum = calculateRegistryChecksum(buffer);

    if (actualChecksum !== expectedChecksum) {
        throw new RegistryValidationError(`Checksum bundle не совпадает: ожидался ${expectedChecksum}, получен ${actualChecksum}`);
    }

    return actualChecksum;
}

function normalizeRegistryBundle(
    value: unknown,
    {
        filePath = null,
        sourceType = 'bundle',
        sourceLabel = 'registry-bundle'
    }: NormalizeRegistryBundleOptions = {}
): EffectiveRegistry {
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

function parseRegistryBundleBuffer(buffer: Buffer, options: NormalizeRegistryBundleOptions = {}): EffectiveRegistry {
    try {
        return normalizeRegistryBundle(JSON.parse(Buffer.from(buffer).toString('utf8')), options);
    } catch (error) {
        if (error instanceof RegistryValidationError) {
            throw error;
        }

        throw new RegistryValidationError('Не удалось разобрать registry bundle', { cause: error });
    }
}

function validateBundleAgainstManifest(bundle: EffectiveRegistry, manifest: RegistryManifest): void {
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
