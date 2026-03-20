import type { LoaderKind } from './metadata';
import type { ServerCoreType } from '../server/types';

export interface PackRuntimeDetection {
    status: 'detected' | 'ambiguous' | 'unknown';
    source: 'instance-manifest' | 'mod-metadata' | 'mixed' | 'none';
    confidence: 'high' | 'medium' | 'low';
    loader: LoaderKind | null;
    loaderVersion: string | null;
    minecraftVersion: string | null;
    supportedServerCore: ServerCoreType | null;
    evidence: string[];
    warnings: string[];
}

export interface BuildServerCoreInstallReport {
    enabledByConfig: boolean;
    requested: boolean;
    status: 'not-requested' | 'skipped' | 'installed' | 'failed';
    cacheHit?: boolean | null;
    coreType: ServerCoreType | null;
    minecraftVersion: string | null;
    loaderVersion: string | null;
    entrypointPath: string | null;
    downloadedArtifactPath: string | null;
    installedAt: string | null;
    notes: string[];
    reason: string | null;
}
