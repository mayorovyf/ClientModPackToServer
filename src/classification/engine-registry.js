const { DEFAULT_ENABLED_ENGINES } = require('./constants');
const { filenameEngine } = require('./engines/filename-engine');
const { metadataEngine } = require('./engines/metadata-engine');
const { registryEngine } = require('./engines/registry-engine');

const AVAILABLE_ENGINES = Object.freeze({
    'metadata-engine': metadataEngine,
    'registry-engine': registryEngine,
    'filename-engine': filenameEngine
});

function getAvailableEngineNames() {
    return Object.keys(AVAILABLE_ENGINES);
}

function createEngineList(engineNames = DEFAULT_ENABLED_ENGINES) {
    return engineNames.map((engineName) => {
        const engine = AVAILABLE_ENGINES[engineName];

        if (!engine) {
            throw new Error(`Unknown classification engine: ${engineName}`);
        }

        return engine;
    });
}

module.exports = {
    AVAILABLE_ENGINES,
    createEngineList,
    getAvailableEngineNames
};
