import type { RoleType } from '../types/classification';
import type { InstanceInputKind, InstanceSource } from '../types/intake';
import type { LoaderKind } from '../types/metadata';
import type { ValidationEntrypointKind, ValidationStatus } from '../types/validation';
import type { FailureFamily } from '../failure/family';

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
}

export interface CandidateState {
    candidateId: string;
    parentCandidateId: string | null;
    iteration: number;
    fingerprint: CandidateFingerprint;
    loader: LoaderKind | null;
    core: string | null;
    javaProfile: string | null;
    launchProfile: {
        validationEntrypointKind: ValidationEntrypointKind | null;
        validationEntrypointPath: string | null;
    };
    currentModDecisions: CandidateModDecisionSummary[];
    appliedFixes: AppliedFix[];
    validation: CandidateValidationSnapshot | null;
    failureFamily: FailureFamily | null;
    evidenceSummary: string[];
    outcomeStatus: 'not-run' | 'passed' | 'failed' | 'skipped';
}

export interface CandidateTrace {
    currentCandidateId: string | null;
    candidates: CandidateState[];
    fingerprintDigests: string[];
    searchBudget: SearchBudget;
}
