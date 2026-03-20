import type { RoleType } from '../types/classification';
import type { InstanceInputKind, InstanceSource } from '../types/intake';
import type { LoaderKind } from '../types/metadata';
import type { TerminalOutcomeId } from '../types/outcome';
import type { RunReport } from '../types/report';
import type { BridgedEcosystemId, ConnectorLayerId, RuntimeTopologyId } from '../types/topology';
import type { TopologyArtifactPartitionKind } from '../types/topology';
import type { ValidationEntrypointKind, ValidationStatus } from '../types/validation';
import type { FailureFamily, NormalizedFailureAnalysis } from '../failure/family';
import type { BaseStaticSnapshot, RealizedStaticSnapshot } from './static-snapshot';
import type { WorkspaceSessionHandle } from '../build/workspace-session';

export interface CandidateFingerprintFile {
    fileName: string;
    fileSha256: string | null;
    loader: LoaderKind | 'unknown';
    modIds: string[];
    version: string | null;
}

export interface CandidateFingerprint {
    algorithm: 'sha256';
    digest: string;
    totalFiles: number;
    detectedLoaders: LoaderKind[];
    inputKind: InstanceInputKind;
    instanceSource: InstanceSource;
    selectedRuntimeTopologyId: RuntimeTopologyId | null;
    files: CandidateFingerprintFile[];
}

export interface SearchBudget {
    maxCandidateStates: number;
    maxRetries: number;
    maxGuardedFixes: number;
    maxWallClockMs: number;
    consumedCandidateStates: number;
    consumedRetries: number;
    consumedGuardedFixes: number;
    consumedWallClockMs: number;
    exhausted: boolean;
}

export interface AppliedFix {
    fixId: string;
    kind: string;
    scope: 'safe-by-default' | 'guarded' | 'manual' | 'none';
    summary: string;
    evidence: string[];
}

export interface CandidateValidationSnapshot {
    status: ValidationStatus | 'not-run';
    entrypointKind: ValidationEntrypointKind | null;
    entrypointPath: string | null;
    successMarkers: number;
    failureMarkers: number;
    totalIssues: number;
    issueKinds: string[];
    durationMs: number;
}

export interface CandidateModDecisionSummary {
    fileName: string;
    finalDecision: string | null;
    buildDecision: string | null;
    actionStatus: string | null;
    roleType: RoleType | null;
    reason: string;
    topologyPartition: TopologyArtifactPartitionKind | null;
    topologyReason: string | null;
}

export interface CandidateState {
    candidateId: string;
    parentCandidateId: string | null;
    iteration: number;
    stateDigest: string;
    fingerprint: CandidateFingerprint;
    runtimeTopologyId: RuntimeTopologyId | null;
    loader: LoaderKind | null;
    connectorLayer: ConnectorLayerId | null;
    bridgedEcosystem: BridgedEcosystemId | null;
    core: string | null;
    javaProfile: string | null;
    validationTimeoutMs: number | null;
    launchProfile: {
        validationEntrypointKind: ValidationEntrypointKind | null;
        validationEntrypointPath: string | null;
    };
    currentModDecisions: CandidateModDecisionSummary[];
    appliedFixes: AppliedFix[];
    validation: CandidateValidationSnapshot | null;
    failureFamily: FailureFamily | null;
    failureAnalysis: NormalizedFailureAnalysis | null;
    evidenceSummary: string[];
    terminalOutcomeId: TerminalOutcomeId | null;
    shortExplanation: string | null;
    outcomeStatus: 'not-run' | 'passed' | 'failed' | 'skipped';
}

export interface CandidateTrace {
    currentCandidateId: string | null;
    candidates: CandidateState[];
    fingerprintDigests: string[];
    searchBudget: SearchBudget;
}

export interface CandidateIterationResult {
    candidate: CandidateState;
    report: RunReport;
    staticSnapshot?: BaseStaticSnapshot;
    realizedSnapshot?: RealizedStaticSnapshot;
    workspaceSession?: WorkspaceSessionHandle;
}
