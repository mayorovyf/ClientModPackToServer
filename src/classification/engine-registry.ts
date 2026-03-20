const { DEFAULT_ENABLED_ENGINES } = require('./constants');
const { probeKnowledgeEngine } = require('./engines/probe-knowledge-engine');
const { clientSignatureEngine } = require('./engines/client-signature-engine');
const { filenameEngine } = require('./engines/filename-engine');
const { forgeBytecodeEngine } = require('./engines/forge-bytecode-engine');
const { forgeSemanticEngine } = require('./engines/forge-semantic-engine');
const { metadataEngine } = require('./engines/metadata-engine');
const { registryEngine } = require('./engines/registry-engine');

import type { ClassificationEngine } from '../types/classification';

const AVAILABLE_ENGINES: Readonly<Record<string, ClassificationEngine>> = Object.freeze({
    'probe-knowledge-engine': probeKnowledgeEngine,
    'metadata-engine': metadataEngine,
    'forge-bytecode-engine': forgeBytecodeEngine,
    'client-signature-engine': clientSignatureEngine,
    'forge-semantic-engine': forgeSemanticEngine,
    'registry-engine': registryEngine,
    'filename-engine': filenameEngine
});

function getAvailableEngineNames(): string[] {
    return Object.keys(AVAILABLE_ENGINES);
}

function createEngineList(engineNames: string[] = [...DEFAULT_ENABLED_ENGINES]): ClassificationEngine[] {
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
