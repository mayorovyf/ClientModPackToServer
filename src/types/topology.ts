import type { LoaderKind } from './metadata';
import type { ValidationEntrypointKind } from './validation';
import type { ManagedServerEntrypointKind, ServerCoreType } from '../server/types';

export type RuntimeTopologyId =
    | 'fabric-single-loader'
    | 'quilt-single-loader'
    | 'forge-single-loader'
    | 'neoforge-single-loader'
    | 'neoforge-sinytra-fabric-bridge';

export type RuntimeTopologyClass = 'single-loader' | 'connector-based' | 'mixed-artifact-set' | 'unresolved';
export type ConnectorLayerId = 'sinytra-connector' | 'unknown-connector-layer';
export type BridgedEcosystemId = 'fabric' | 'quilt' | 'forge' | 'neoforge';
export type RuntimeTopologyAssessmentKind = 'supported' | 'pending' | 'unsupported' | 'blocked-by-trust-policy';
export type TrustedArtifactProvenance = 'source-instance' | 'explicit-validation-entrypoint' | 'managed-server-installer';
export type JavaProfileId = 'auto' | 'java-17' | 'java-21';

export interface TopologyWhitelistEntry {
    topologyId: RuntimeTopologyId;
    summary: string;
    supportLevel: 'supported' | 'pending';
    topologyClass: 'single-loader' | 'connector-based';
    baseLoader: LoaderKind;
    connectorLayer: ConnectorLayerId | null;
    bridgedEcosystem: BridgedEcosystemId | null;
    allowedCoreTypes: ServerCoreType[];
    allowedValidationEntrypointKinds: ValidationEntrypointKind[];
    allowedManagedEntrypointKinds: ManagedServerEntrypointKind[];
    allowedJavaProfiles: JavaProfileId[];
    trustedArtifactProvenance: TrustedArtifactProvenance[];
}

export interface RuntimeTopologyAssessment {
    status: 'supported' | 'unsupported' | 'pending';
    assessment: RuntimeTopologyAssessmentKind;
    code: string;
    summary: string;
    topologyId: RuntimeTopologyId | null;
    topologyClass: RuntimeTopologyClass;
    baseLoader: LoaderKind | null;
    connectorLayer: ConnectorLayerId | null;
    bridgedEcosystem: BridgedEcosystemId | null;
    detectedLoaders: LoaderKind[];
    detectedConnectorHints: string[];
    matchedWhitelistEntry: TopologyWhitelistEntry | null;
    supportedTopologyIds: RuntimeTopologyId[];
    pendingTopologyIds: RuntimeTopologyId[];
    trustedArtifactProvenance: TrustedArtifactProvenance[];
    policyBlockedReason: string | null;
}
