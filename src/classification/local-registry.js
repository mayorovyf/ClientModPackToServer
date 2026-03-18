const fs = require('fs');
const path = require('path');

const { FileReadError } = require('../core/errors');
const { createEmptyRegistry, normalizeRegistryDocument, normalizeRegistryRule } = require('../registry/rules');

function createEmptyLocalRegistry(filePath = null) {
    return createEmptyRegistry(filePath, {
        sourceType: 'local-registry',
        sourceLabel: 'local-registry',
        registryVersion: 'embedded'
    });
}

function loadLocalRegistry(filePath, { required = false, logger = null } = {}) {
    const resolvedPath = filePath ? path.resolve(filePath) : null;

    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
        if (required) {
            throw new FileReadError(`Failed to read local registry file: ${filePath}`);
        }

        if (logger) {
            logger.warn(`Local registry file was not found, continuing with an empty registry: ${filePath}`);
        }

        return createEmptyLocalRegistry(resolvedPath);
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
        return normalizeRegistryDocument(parsed, {
            filePath: resolvedPath,
            exists: true,
            defaultSource: 'local-registry',
            sourceType: 'local-registry',
            sourceLabel: 'local-registry',
            registryVersion: 'embedded'
        });
    } catch (error) {
        throw new FileReadError(`Failed to parse local registry file: ${resolvedPath}`, { cause: error });
    }
}

module.exports = {
    createEmptyLocalRegistry,
    loadLocalRegistry,
    normalizeRegistryRule
};
