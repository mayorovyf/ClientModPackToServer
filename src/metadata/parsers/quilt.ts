const { LOADER_TYPES } = require('../constants');
const { createParsingIssue } = require('../descriptor');
const {
    chooseDeclaredSide,
    normalizeDependencyList,
    normalizeEntrypoints,
    normalizeMixinConfigs,
    normalizeProvides
} = require('./utils');

import type { DescriptorPatch } from '../../types/descriptor';

function parseQuiltMetadata(content: string | null): DescriptorPatch {
    let parsed: Record<string, unknown>;

    try {
        parsed = JSON.parse(content || '');
    } catch {
        return {
            parsingErrors: [
                createParsingIssue({
                    code: 'QUILT_METADATA_JSON_INVALID',
                    message: 'Не удалось распарсить quilt.mod.json',
                    source: 'quilt.mod.json'
                })
            ]
        };
    }

    const quiltLoader = parsed.quilt_loader && typeof parsed.quilt_loader === 'object'
        ? parsed.quilt_loader as Record<string, unknown>
        : {};
    const quiltMetadata = quiltLoader.metadata && typeof quiltLoader.metadata === 'object'
        ? quiltLoader.metadata as Record<string, unknown>
        : parsed.metadata && typeof parsed.metadata === 'object'
            ? parsed.metadata as Record<string, unknown>
            : {};

    return {
        loader: LOADER_TYPES.quilt,
        modIds: [quiltLoader.id ? String(quiltLoader.id) : ''],
        displayName: quiltMetadata.name ? String(quiltMetadata.name) : quiltLoader.name ? String(quiltLoader.name) : null,
        version: quiltLoader.version ? String(quiltLoader.version) : null,
        declaredSide: chooseDeclaredSide(quiltMetadata.environment, quiltLoader.environment),
        metadataFilesFound: ['quilt.mod.json'],
        entrypoints: normalizeEntrypoints(quiltLoader.entrypoints, LOADER_TYPES.quilt),
        mixinConfigs: normalizeMixinConfigs(quiltLoader.mixin),
        dependencies: normalizeDependencyList(quiltLoader.depends, 'depends', LOADER_TYPES.quilt, true),
        optionalDependencies: normalizeDependencyList(quiltLoader.recommends, 'recommends', LOADER_TYPES.quilt, false),
        incompatibilities: normalizeDependencyList(quiltLoader.breaks, 'breaks', LOADER_TYPES.quilt, false),
        provides: normalizeProvides(quiltLoader.provides),
        parsingWarnings: []
    };
}

module.exports = {
    parseQuiltMetadata
};
