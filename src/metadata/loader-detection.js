const { LOADER_TYPES } = require('./constants');

const METADATA_ENTRY_MAP = Object.freeze({
    'fabric.mod.json': LOADER_TYPES.fabric,
    'quilt.mod.json': LOADER_TYPES.quilt,
    'META-INF/mods.toml': LOADER_TYPES.forge,
    'META-INF/neoforge.mods.toml': LOADER_TYPES.neoforge,
    'META-INF/MANIFEST.MF': 'manifest'
});

const DETECTION_PRIORITY = [
    LOADER_TYPES.neoforge,
    LOADER_TYPES.forge,
    LOADER_TYPES.quilt,
    LOADER_TYPES.fabric
];

function detectLoader(entryNames = []) {
    const foundMetadataFiles = entryNames.filter((entryName) => Object.prototype.hasOwnProperty.call(METADATA_ENTRY_MAP, entryName));
    const loaderCandidates = foundMetadataFiles
        .map((entryName) => METADATA_ENTRY_MAP[entryName])
        .filter((loader) => loader !== 'manifest');

    const loader = DETECTION_PRIORITY.find((candidate) => loaderCandidates.includes(candidate)) || LOADER_TYPES.unknown;

    return {
        loader,
        metadataFilesFound: foundMetadataFiles
    };
}

module.exports = {
    detectLoader,
    METADATA_ENTRY_MAP
};
