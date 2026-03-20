const { createClassificationContext } = require('../classification/context');
const { loadBlockList } = require('../io/block-list');
const { loadProbeKnowledge } = require('../probe/knowledge-store');
const { loadEffectiveRegistry } = require('../registry/effective-registry');

import type { RuntimeConfig } from '../types/config';
import type { LoadRuntimeStateResult, RegistryRuntimeBundle } from '../types/app';
import type { RunContext } from '../types/run';
import type { ApplicationLogger } from '../types/app';

interface LoadRuntimeStateParams {
    config: RuntimeConfig;
    runContext: RunContext;
    logger: ApplicationLogger;
}

async function loadRuntimeState({ config, logger }: LoadRuntimeStateParams): Promise<LoadRuntimeStateResult> {
    const blockList = loadBlockList(config.blockListPath, logger) as string[];
    const registryRuntime = await loadEffectiveRegistry({
        embeddedRegistryPath: config.registryFilePath,
        embeddedRegistryRequired: config.registryFileRequired,
        localOverridesPath: config.localOverridesPath,
        cacheDir: config.registryCacheDir,
        mode: config.registryMode,
        manifestUrl: config.registryManifestUrl,
        bundleUrl: config.registryBundleUrl,
        timeoutMs: config.registryFetchTimeoutMs,
        logger
    }) as RegistryRuntimeBundle;
    const probeKnowledge = {
        filePath: config.probeKnowledgePath,
        entries: loadProbeKnowledge(config.probeKnowledgePath).entries
    };
    const classificationContext = createClassificationContext({
        blockList,
        localRegistry: registryRuntime.registry,
        probeKnowledge,
        enabledEngines: config.enabledEngines,
        disabledEngines: config.disabledEngines
    });

    return {
        blockList,
        registryRuntime,
        probeKnowledge,
        classificationContext
    };
}

module.exports = {
    loadRuntimeState
};
