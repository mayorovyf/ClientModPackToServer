import type { LoaderKind } from './metadata';

export type RegistrySide = 'client' | 'server' | 'both' | 'unknown';
export type RegistryConfidence = 'high' | 'medium' | 'low' | 'none';

export interface RegistryRule {
    ruleId: string;
    modIds: string[];
    aliases: string[];
    fileNames: string[];
    loaders: LoaderKind[];
    side: RegistrySide;
    confidence: RegistryConfidence;
    reason: string;
    source: string;
    priority?: number;
    updatedAt?: string | null;
    notes?: string | null;
}

export interface RegistryBundle {
    schemaVersion: number;
    registryVersion: string;
    generatedAt: string | null;
    rules: RegistryRule[];
}

export interface RegistryManifest {
    schemaVersion: number;
    registryVersion: string;
    bundleFile: string;
    bundleChecksum: string;
    bundleSize?: number | null;
    publishedAt?: string | null;
    source?: string | null;
    manifestUrl?: string | null;
    bundleUrl?: string | null;
}

export interface RegistryOverride {
    modId: string;
    side?: RegistrySide | null;
    confidence?: RegistryConfidence | null;
    forceKeep?: boolean;
    forceRemove?: boolean;
    reason?: string | null;
}

export interface EffectiveRegistry {
    schemaVersion: number;
    registryVersion: string;
    generatedAt: string | null;
    filePath?: string | null;
    exists?: boolean;
    sourceType?: string;
    sourceLabel?: string;
    rules: RegistryRule[];
    summary?: {
        ruleCount: number;
        bySide: Record<RegistrySide, number>;
    };
    metadata?: Record<string, unknown>;
}

export interface RegistryRuntimeIssue {
    code: string;
    message: string;
    slot?: string;
}

export interface RegistryRuntimeEvent {
    timestamp: string;
    level: string;
    kind: string;
    message: string;
}

export interface RegistryRuntimeState {
    mode: 'auto' | 'offline' | 'refresh' | 'pinned';
    source: string;
    sourceDescription: string;
    sourceOfTruth?: string;
    registryVersion: string;
    schemaVersion?: number | null;
    refreshAttempted: boolean;
    refreshSucceeded: boolean;
    usedCache: boolean;
    usedEmbeddedFallback: boolean;
    usedLocalOverrides: boolean;
    cacheSlot?: string | null;
    manifestUrl?: string | null;
    bundleUrl?: string | null;
    cacheDir?: string | null;
    embeddedRegistryPath?: string | null;
    localOverridesPath?: string | null;
    selectedBasePath?: string | null;
    baseRuleCount?: number;
    localOverrideRuleCount?: number;
    effectiveRuleCount: number;
    warnings: string[];
    errors: RegistryRuntimeIssue[];
    events: RegistryRuntimeEvent[];
}

export interface RegistryCacheLayout {
    rootDir: string;
    manifestPath: string;
    bundlePath: string;
    previousManifestPath: string;
    previousBundlePath: string;
}

export interface RegistryCacheSlotPaths {
    manifestPath: string;
    bundlePath: string;
}

export interface CachedRegistrySnapshot {
    slot: 'current' | 'previous';
    manifest: RegistryManifest;
    registry: EffectiveRegistry;
    manifestPath: string;
    bundlePath: string;
}
