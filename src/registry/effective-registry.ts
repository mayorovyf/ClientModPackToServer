const { loadLocalRegistry } = require('../classification/local-registry');
const { createEmptyRegistry, createRegistrySnapshot } = require('./rules');
const { createRegistryCacheLayout } = require('./cache-layout');
const { readCachedRegistry } = require('./cache-reader');
const { loadLocalOverrides } = require('./local-overrides');
const { refreshRegistryCache } = require('./update-registry');
const { createRegistryRuntimeState, describeRegistrySource } = require('./runtime-source');
const { REGISTRY_RUNTIME_MODES, REGISTRY_RUNTIME_SOURCES } = require('./constants');

import type {
    CachedRegistrySnapshot,
    EffectiveRegistry,
    RegistryRuntimeIssue,
    RegistryRuntimeState
} from '../types/registry';

interface LoggerLike {
    registryCache?: (message: string) => void;
    registryUpdate?: (message: string) => void;
    registryError?: (message: string) => void;
    registryWarn?: (message: string) => void;
    registry?: (message: string) => void;
    error?: (message: string) => void;
    warn?: (message: string) => void;
    info?: (message: string) => void;
}

interface RegistryEventCollector {
    events: RegistryRuntimeState['events'];
    emit: (level: string, kind: string, message: string) => void;
}

interface LoadEffectiveRegistryParams {
    embeddedRegistryPath: string;
    embeddedRegistryRequired?: boolean;
    localOverridesPath?: string | null;
    cacheDir: string;
    mode?: RegistryRuntimeState['mode'];
    manifestUrl?: string | null;
    bundleUrl?: string | null;
    timeoutMs?: number;
    logger?: LoggerLike | null;
}

function createRegistryEventCollector(logger: LoggerLike | null = null): RegistryEventCollector {
    const events: RegistryRuntimeState['events'] = [];

    function emit(level: string, kind: string, message: string): void {
        events.push({
            timestamp: new Date().toISOString(),
            level,
            kind,
            message
        });

        if (!logger) {
            return;
        }

        if (kind === 'registry-cache' && typeof logger.registryCache === 'function') {
            logger.registryCache(message);
            return;
        }

        if (kind === 'registry-update' && typeof logger.registryUpdate === 'function') {
            logger.registryUpdate(message);
            return;
        }

        if (kind === 'registry-error' && typeof logger.registryError === 'function') {
            logger.registryError(message);
            return;
        }

        if (kind === 'registry-warn' && typeof logger.registryWarn === 'function') {
            logger.registryWarn(message);
            return;
        }

        if (typeof logger.registry === 'function') {
            logger.registry(message);
            return;
        }

        if (level === 'error') {
            logger.error?.(message);
        } else if (level === 'warn') {
            logger.warn?.(message);
        } else {
            logger.info?.(message);
        }
    }

    return {
        events,
        emit
    };
}

function serializeRegistryError(error: Error & { code?: string }): RegistryRuntimeIssue {
    return {
        code: error.code || 'REGISTRY_ERROR',
        message: error.message
    };
}

function selectBaseRegistry({
    mode,
    embeddedRegistry,
    cachedRegistry,
    runtime,
    emit
}: {
    mode: RegistryRuntimeState['mode'];
    embeddedRegistry: EffectiveRegistry;
    cachedRegistry: CachedRegistrySnapshot | null;
    runtime: RegistryRuntimeState;
    emit: RegistryEventCollector['emit'];
}): EffectiveRegistry {
    if (cachedRegistry) {
        runtime.usedCache = true;
        runtime.cacheSlot = cachedRegistry.slot;
        runtime.source = cachedRegistry.slot === 'previous'
            ? REGISTRY_RUNTIME_SOURCES.cachePrevious
            : REGISTRY_RUNTIME_SOURCES.cacheCurrent;
        runtime.sourceDescription = describeRegistrySource(runtime.source);

        emit('info', 'registry', `Для запуска выбран registry snapshot из кэша: ${runtime.sourceDescription}`);
        return cachedRegistry.registry;
    }

    runtime.usedEmbeddedFallback = true;
    runtime.source = REGISTRY_RUNTIME_SOURCES.embedded;
    runtime.sourceDescription = describeRegistrySource(runtime.source);

    if (mode === REGISTRY_RUNTIME_MODES.pinned) {
        emit('warn', 'registry-warn', 'Pinned-режим не нашёл валидный cache snapshot, используется встроенный fallback');
    } else if (mode === REGISTRY_RUNTIME_MODES.offline) {
        emit('warn', 'registry-warn', 'Offline-режим не нашёл валидный cache snapshot, используется встроенный fallback');
    } else {
        emit('info', 'registry', 'Используется встроенный fallback реестра');
    }

    return embeddedRegistry;
}

async function loadEffectiveRegistry({
    embeddedRegistryPath,
    embeddedRegistryRequired = false,
    localOverridesPath,
    cacheDir,
    mode = REGISTRY_RUNTIME_MODES.auto,
    manifestUrl = null,
    bundleUrl = null,
    timeoutMs,
    logger = null
}: LoadEffectiveRegistryParams): Promise<{ registry: EffectiveRegistry; runtime: RegistryRuntimeState }> {
    const collector = createRegistryEventCollector(logger);
    const runtime = createRegistryRuntimeState({
        mode,
        manifestUrl,
        bundleUrl,
        cacheDir,
        embeddedRegistryPath,
        localOverridesPath
    });
    const cacheLayout = createRegistryCacheLayout(cacheDir);

    collector.emit('info', 'registry', `Режим реестра: ${mode}`);
    collector.emit('info', 'registry', `Встроенный fallback: ${embeddedRegistryPath}`);
    collector.emit('info', 'registry-cache', `Каталог кэша реестра: ${cacheLayout.rootDir}`);

    const embeddedRegistry = loadLocalRegistry(embeddedRegistryPath, {
        required: embeddedRegistryRequired,
        logger
    }) as EffectiveRegistry;

    if ([REGISTRY_RUNTIME_MODES.auto, REGISTRY_RUNTIME_MODES.refresh].includes(mode) && manifestUrl) {
        runtime.refreshAttempted = true;

        try {
            const refreshResult = await refreshRegistryCache({
                manifestUrl,
                bundleUrlOverride: bundleUrl,
                cacheLayout,
                timeoutMs,
                record: collector.emit
            });

            runtime.refreshSucceeded = true;
            runtime.bundleUrl = refreshResult.bundleUrl;
        } catch (error) {
            const registryError = error as Error & { code?: string };
            runtime.refreshSucceeded = false;
            runtime.errors.push(serializeRegistryError(registryError));
            collector.emit('error', 'registry-error', `Не удалось обновить реестр: ${registryError.message}`);
        }
    }

    const cachedState = readCachedRegistry(cacheLayout, {
        record: collector.emit
    });
    runtime.errors.push(...cachedState.errors);

    let localOverrides = createEmptyRegistry(localOverridesPath || null, {
        sourceType: 'local-overrides',
        sourceLabel: 'local-overrides',
        registryVersion: 'local-overrides'
    });

    try {
        localOverrides = loadLocalOverrides(localOverridesPath || null, { logger });
    } catch (error) {
        const registryError = error as Error & { code?: string };
        runtime.errors.push(serializeRegistryError(registryError));
        collector.emit('error', 'registry-error', `Локальные overrides отключены из-за ошибки: ${registryError.message}`);
    }

    const baseRegistry = selectBaseRegistry({
        mode,
        embeddedRegistry,
        cachedRegistry: cachedState.snapshot,
        runtime,
        emit: collector.emit
    });

    runtime.usedLocalOverrides = localOverrides.rules.length > 0;
    runtime.schemaVersion = baseRegistry.schemaVersion;
    runtime.registryVersion = baseRegistry.registryVersion;
    runtime.selectedBasePath = baseRegistry.filePath || null;
    runtime.baseRuleCount = baseRegistry.rules.length;
    runtime.localOverrideRuleCount = localOverrides.rules.length;

    const registry = createRegistrySnapshot({
        schemaVersion: baseRegistry.schemaVersion,
        registryVersion: baseRegistry.registryVersion,
        generatedAt: baseRegistry.generatedAt,
        filePath: baseRegistry.filePath || null,
        exists: Boolean(baseRegistry.exists),
        sourceType: 'effective-registry',
        sourceLabel: runtime.source,
        rules: [...baseRegistry.rules, ...localOverrides.rules],
        metadata: {
            baseSource: runtime.source,
            baseSourceDescription: runtime.sourceDescription,
            baseRuleCount: baseRegistry.rules.length,
            localOverrideRuleCount: localOverrides.rules.length,
            embeddedRegistryPath,
            localOverridesPath,
            cacheDir: cacheLayout.rootDir
        }
    });

    runtime.effectiveRuleCount = registry.rules.length;

    if (runtime.usedLocalOverrides) {
        collector.emit(
            'info',
            'registry',
            `Применены локальные overrides: ${localOverrides.rules.length} правил(а)`
        );
    }

    runtime.events = collector.events;
    runtime.warnings = collector.events.filter((event) => event.level === 'warn').map((event) => event.message);

    return {
        registry,
        runtime
    };
}

module.exports = {
    loadEffectiveRegistry
};
