const toml = require('toml');

const { LOADER_TYPES } = require('../constants');
const { createParsingIssue, dedupeStrings } = require('../descriptor');
const { chooseDeclaredSide, normalizeTomlDependencies } = require('./utils');

function parseModsToml(content) {
    let parsed;

    try {
        parsed = toml.parse(content);
    } catch (error) {
        return {
            parsingErrors: [
                createParsingIssue({
                    code: 'FORGE_METADATA_TOML_INVALID',
                    message: 'Не удалось распарсить META-INF/mods.toml',
                    source: 'META-INF/mods.toml'
                })
            ]
        };
    }

    const mods = Array.isArray(parsed.mods) ? parsed.mods : [];
    const primaryMod = mods[0] || {};
    const dependencyData = normalizeTomlDependencies(parsed.dependencies, LOADER_TYPES.forge);

    return {
        loader: LOADER_TYPES.forge,
        modIds: dedupeStrings(mods.map((item) => item.modId)),
        displayName: primaryMod.displayName || null,
        version: primaryMod.version || null,
        declaredSide: chooseDeclaredSide(primaryMod.side, parsed.side, parsed.clientSideOnly ? 'client' : null),
        metadataFilesFound: ['META-INF/mods.toml'],
        entrypoints: [],
        mixinConfigs: [],
        dependencies: dependencyData.dependencies,
        optionalDependencies: dependencyData.optionalDependencies,
        incompatibilities: dependencyData.incompatibilities,
        provides: [],
        parsingWarnings: mods.length > 1
            ? [
                  createParsingIssue({
                      code: 'FORGE_MULTI_MOD_JAR',
                      message: `Обнаружено несколько модов в mods.toml: ${mods.length}`,
                      source: 'META-INF/mods.toml',
                      fatal: false
                  })
              ]
            : []
    };
}

module.exports = {
    parseModsToml
};
