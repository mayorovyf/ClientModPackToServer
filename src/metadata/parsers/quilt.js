const { LOADER_TYPES } = require('../constants');
const { createParsingIssue } = require('../descriptor');
const {
    chooseDeclaredSide,
    normalizeDependencyList,
    normalizeEntrypoints,
    normalizeMixinConfigs,
    normalizeProvides
} = require('./utils');

function parseQuiltMetadata(content) {
    let parsed;

    try {
        parsed = JSON.parse(content);
    } catch (error) {
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

    const quiltLoader = parsed.quilt_loader || {};
    const quiltMetadata = quiltLoader.metadata || parsed.metadata || {};

    return {
        loader: LOADER_TYPES.quilt,
        modIds: [quiltLoader.id],
        displayName: quiltMetadata.name || quiltLoader.name || null,
        version: quiltLoader.version || null,
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
