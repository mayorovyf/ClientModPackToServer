const { RunConfigurationError } = require('../core/errors');
const { DEFAULT_ENABLED_ENGINES } = require('./constants');
const { getAvailableEngineNames } = require('./engine-registry');
const { createEmptyLocalRegistry } = require('./local-registry');

import type { ClassificationContext } from '../types/classification';

function normalizeEngineNames(engineNames: unknown): string[] {
    return [...new Set((Array.isArray(engineNames) ? engineNames : [])
        .map((name) => String(name || '').trim().toLowerCase())
        .filter(Boolean))];
}

function createClassificationContext({
    blockList = [],
    localRegistry = null,
    enabledEngines = DEFAULT_ENABLED_ENGINES,
    disabledEngines = []
}: {
    blockList?: string[];
    localRegistry?: ClassificationContext['localRegistry'] | null;
    enabledEngines?: string[];
    disabledEngines?: string[];
} = {}): ClassificationContext {
    const availableEngines = getAvailableEngineNames();
    const disabled = new Set(normalizeEngineNames(disabledEngines));
    const configured = normalizeEngineNames(enabledEngines).filter((engineName) => !disabled.has(engineName));

    if (configured.length === 0) {
        throw new RunConfigurationError('At least one classification engine must remain enabled');
    }

    for (const engineName of configured) {
        if (!availableEngines.includes(engineName)) {
            throw new RunConfigurationError(`Unknown classification engine: ${engineName}`);
        }
    }

    return {
        blockList,
        localRegistry: localRegistry || createEmptyLocalRegistry(),
        availableEngines,
        enabledEngines: configured
    };
}

module.exports = {
    createClassificationContext,
    normalizeEngineNames
};
