const { LOADER_TYPES } = require('../constants');
const { createParsingIssue } = require('../descriptor');
const {
    chooseDeclaredSide,
    normalizeEntrypoints,
    normalizeFabricDependencyMap,
    normalizeMixinConfigs,
    normalizeProvides
} = require('./utils');

function parseFabricMetadata(content) {
    let parsed;

    try {
        parsed = JSON.parse(content);
    } catch (error) {
        return {
            parsingErrors: [
                createParsingIssue({
                    code: 'FABRIC_METADATA_JSON_INVALID',
                    message: 'Не удалось распарсить fabric.mod.json',
                    source: 'fabric.mod.json'
                })
            ]
        };
    }

    return {
        loader: LOADER_TYPES.fabric,
        modIds: [parsed.id],
        displayName: parsed.name || null,
        version: parsed.version || null,
        declaredSide: chooseDeclaredSide(parsed.environment),
        metadataFilesFound: ['fabric.mod.json'],
        entrypoints: normalizeEntrypoints(parsed.entrypoints, LOADER_TYPES.fabric),
        mixinConfigs: normalizeMixinConfigs(parsed.mixins),
        dependencies: normalizeFabricDependencyMap(parsed.depends, 'depends', LOADER_TYPES.fabric),
        optionalDependencies: [
            ...normalizeFabricDependencyMap(parsed.recommends, 'recommends', LOADER_TYPES.fabric)
        ],
        incompatibilities: [
            ...normalizeFabricDependencyMap(parsed.conflicts, 'conflicts', LOADER_TYPES.fabric),
            ...normalizeFabricDependencyMap(parsed.breaks, 'breaks', LOADER_TYPES.fabric)
        ],
        provides: normalizeProvides(parsed.provides),
        parsingWarnings: []
    };
}

module.exports = {
    parseFabricMetadata
};
