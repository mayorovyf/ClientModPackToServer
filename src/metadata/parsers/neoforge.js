const toml = require('toml');

const { LOADER_TYPES } = require('../constants');
const { createParsingIssue, dedupeStrings } = require('../descriptor');
const { chooseDeclaredSide, normalizeTomlDependencies } = require('./utils');

function parseNeoForgeMetadata(content) {
    let parsed;

    try {
        parsed = toml.parse(content);
    } catch (error) {
        return {
            parsingErrors: [
                createParsingIssue({
                    code: 'NEOFORGE_METADATA_TOML_INVALID',
                    message: 'Не удалось распарсить META-INF/neoforge.mods.toml',
                    source: 'META-INF/neoforge.mods.toml'
                })
            ]
        };
    }

    const mods = Array.isArray(parsed.mods) ? parsed.mods : [];
    const primaryMod = mods[0] || {};
    const dependencyData = normalizeTomlDependencies(parsed.dependencies, LOADER_TYPES.neoforge);

    return {
        loader: LOADER_TYPES.neoforge,
        modIds: dedupeStrings(mods.map((item) => item.modId)),
        displayName: primaryMod.displayName || null,
        version: primaryMod.version || null,
        declaredSide: chooseDeclaredSide(primaryMod.side, parsed.side, parsed.clientSideOnly ? 'client' : null),
        metadataFilesFound: ['META-INF/neoforge.mods.toml'],
        entrypoints: [],
        mixinConfigs: [],
        dependencies: dependencyData.dependencies,
        optionalDependencies: dependencyData.optionalDependencies,
        incompatibilities: dependencyData.incompatibilities,
        provides: [],
        parsingWarnings: mods.length > 1
            ? [
                  createParsingIssue({
                      code: 'NEOFORGE_MULTI_MOD_JAR',
                      message: `Обнаружено несколько модов в neoforge.mods.toml: ${mods.length}`,
                      source: 'META-INF/neoforge.mods.toml',
                      fatal: false
                  })
              ]
            : []
    };
}

module.exports = {
    parseNeoForgeMetadata
};
