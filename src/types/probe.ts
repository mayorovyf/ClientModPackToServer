import type { ConfidenceLevel, RoleType, SemanticDecision } from './classification';

export type ProbeMode = 'off' | 'auto' | 'force';
export type ProbeOutcomeKind =
    | 'server_boot_ok'
    | 'client_classload_failure'
    | 'missing_required_dependency'
    | 'side_only_violation'
    | 'mixin_target_failure'
    | 'late_runtime_failure'
    | 'inconclusive';

export type ProbeKnowledgeMatchKind = 'exact' | 'soft';

export interface ProbeFingerprint {
    fileSha256: string | null;
    fileName: string;
    loader: string;
    version: string | null;
    modIds: string[];
}

export interface ProbeKnowledgeEntry {
    fingerprint: ProbeFingerprint;
    outcome: ProbeOutcomeKind;
    semanticDecision: SemanticDecision | 'unknown';
    roleType: RoleType;
    confidence: ConfidenceLevel;
    reason: string;
    evidence: string[];
    observedAt: string;
    source: 'server-probe';
    exactBoot: boolean;
}

export interface ProbeKnowledgeFile {
    version: 1;
    updatedAt: string;
    entries: ProbeKnowledgeEntry[];
}

export interface ProbeKnowledgeMatch {
    kind: ProbeKnowledgeMatchKind;
    entry: ProbeKnowledgeEntry;
}

export interface ProbePlanStep {
    id: string;
    fileName: string;
    sourcePath: string;
    requiredSupportFiles: string[];
    roleHint: RoleType;
    confidenceHint: ConfidenceLevel;
    priority: number;
}

export interface ProbeOutcome {
    fileName: string;
    sourcePath: string;
    requiredSupportFiles: string[];
    outcome: ProbeOutcomeKind;
    semanticDecision: SemanticDecision | 'unknown';
    roleType: RoleType;
    confidence: ConfidenceLevel;
    reason: string;
    evidence: string[];
    logPath?: string | null;
    durationMs: number;
    timedOut: boolean;
    knowledgeApplied: boolean;
}

export interface ProbeSummary {
    status: 'skipped' | 'completed' | 'error';
    mode: ProbeMode;
    attempted: number;
    planned: number;
    reusedKnowledge: number;
    storedKnowledge: number;
    resolvedToKeep: number;
    resolvedToRemove: number;
    inconclusive: number;
    skipReason: string | null;
    knowledgePath: string | null;
    outcomes: ProbeOutcome[];
    errors: Array<{
        code: string;
        message: string;
    }>;
}
