const { RunConfigurationError } = require('../core/errors');
const { REGISTRY_RUNTIME_MODES, REGISTRY_RUNTIME_SOURCES } = require('./constants');

import type { RegistryRuntimeState } from '../types/registry';

type RegistryModeValue = RegistryRuntimeState['mode'];

function normalizeRegistryMode(mode?: string | null): RegistryModeValue | null {
    const normalized = String(mode || '').trim().toLowerCase();

    if (!normalized) {
        return REGISTRY_RUNTIME_MODES.auto;
    }

    return Object.values(REGISTRY_RUNTIME_MODES).includes(normalized as RegistryModeValue)
        ? normalized as RegistryModeValue
        : null;
}

function assertRegistryMode(mode?: string | null): RegistryModeValue {
    const normalized = normalizeRegistryMode(mode);

    if (!normalized) {
        throw new RunConfigurationError(`Неизвестный режим реестра: ${mode}`);
    }

    return normalized;
}

function describeRegistrySource(source: string): string {
    switch (source) {
        case REGISTRY_RUNTIME_SOURCES.cacheCurrent:
            return 'активный локальный кэш';
        case REGISTRY_RUNTIME_SOURCES.cachePrevious:
            return 'предыдущий локальный кэш';
        case REGISTRY_RUNTIME_SOURCES.embedded:
            return 'встроенный fallback';
        default:
            return 'пустой реестр';
    }
}

function createRegistryRuntimeState({
    mode = REGISTRY_RUNTIME_MODES.auto,
    manifestUrl = null,
    bundleUrl = null,
    cacheDir = null,
    embeddedRegistryPath = null,
    localOverridesPath = null
}: Partial<RegistryRuntimeState> = {}): RegistryRuntimeState {
    return {
        mode,
        source: REGISTRY_RUNTIME_SOURCES.empty,
        sourceDescription: describeRegistrySource(REGISTRY_RUNTIME_SOURCES.empty),
        sourceOfTruth: 'remote-registry-repository',
        registryVersion: 'unversioned',
        schemaVersion: null,
        refreshAttempted: false,
        refreshSucceeded: false,
        usedCache: false,
        usedEmbeddedFallback: false,
        usedLocalOverrides: false,
        cacheSlot: null,
        manifestUrl,
        bundleUrl,
        cacheDir,
        embeddedRegistryPath,
        localOverridesPath,
        selectedBasePath: null,
        baseRuleCount: 0,
        localOverrideRuleCount: 0,
        effectiveRuleCount: 0,
        warnings: [],
        errors: [],
        events: []
    };
}

module.exports = {
    assertRegistryMode,
    createRegistryRuntimeState,
    describeRegistrySource,
    normalizeRegistryMode
};
