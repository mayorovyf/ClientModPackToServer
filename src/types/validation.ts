import type { ConfidenceLevel, SemanticDecision } from './classification';

export type ValidationMode = 'off' | 'auto' | 'require' | 'force';
export type ValidationStatus = 'not-run' | 'passed' | 'failed' | 'timed-out' | 'error' | 'skipped';
export type ValidationEntrypointKind = 'jar' | 'node-script' | 'cmd-script' | 'powershell-script' | 'executable';
export type ValidationEntrypointSource = 'auto' | 'explicit';
export type ValidationIssueKind =
    | 'missing-dependency'
    | 'side-mismatch'
    | 'class-loading'
    | 'mixin-failure'
    | 'entrypoint-crash'
    | 'unknown-critical'
    | 'validation-no-success-marker';
export type ValidationLinkMatch = 'modId' | 'jarHint';

export interface ValidationError {
    code: string;
    message: string;
}

export interface ValidationMarker {
    label: string;
    evidence: string;
}

export interface ValidationEntrypoint {
    path: string;
    originalPath: string;
    source: ValidationEntrypointSource;
    kind: ValidationEntrypointKind;
}

export interface ValidationLogArtifacts {
    combinedLogPath?: string | null;
    stdoutLogPath?: string | null;
    stderrLogPath?: string | null;
}

export interface LinkedValidationDecision {
    fileName: string;
    matchedBy: ValidationLinkMatch;
    buildDecision: string | null;
    actionStatus: string | null;
    semanticDecision: SemanticDecision | string | null;
    arbiterDecision: SemanticDecision | string | null;
    deepCheckDecision: SemanticDecision | string | null;
    dependencyAdjusted: boolean;
    modIds: string[];
}

export interface ValidationIssue {
    kind: ValidationIssueKind;
    message: string;
    evidence: string;
    modIds: string[];
    suspectedModIds: string[];
    jarHints: string[];
    confidence: ConfidenceLevel;
    linkedDecisions?: LinkedValidationDecision[];
}

export interface ValidationSuspectedFalseRemoval {
    fileName: string;
    matchedBy: ValidationLinkMatch;
    buildDecision: string | null;
    actionStatus: string | null;
    semanticDecision: SemanticDecision | string | null;
    arbiterDecision: SemanticDecision | string | null;
    deepCheckDecision: SemanticDecision | string | null;
    issueKind: ValidationIssueKind;
    reason: string;
}

export interface ValidationSummary {
    totalIssues: number;
    suspectedFalseRemovals: number;
    successMarkers: number;
    failureMarkers: number;
    linkedIssues: number;
}

export interface ValidationResult {
    status: ValidationStatus;
    mode: ValidationMode;
    runAttempted: boolean;
    skipReason: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    durationMs: number;
    entrypoint: ValidationEntrypoint | null;
    workingDirectory: string | null;
    successMarkers: ValidationMarker[];
    failureMarkers: ValidationMarker[];
    issues: ValidationIssue[];
    suspectedFalseRemovals: ValidationSuspectedFalseRemoval[];
    logArtifacts: ValidationLogArtifacts;
    warnings: string[];
    errors: ValidationError[];
    summary: ValidationSummary;
}

export interface ValidationParseResult {
    issues: ValidationIssue[];
    failureMarkers: ValidationMarker[];
}

export interface ValidationLinkResult {
    issues: ValidationIssue[];
    suspectedFalseRemovals: ValidationSuspectedFalseRemoval[];
}

export interface ValidationProcessCommand {
    command: string;
    args: string[];
}

export interface ValidationProcessRuntime {
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    command: ValidationProcessCommand;
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    timedOut: boolean;
    spawnError: Error | null;
    completionReason: string;
    stdout: string;
    stderr: string;
    combinedOutput: string;
    successMarkers: ValidationMarker[];
}

export interface ValidationDecisionLike {
    fileName: string;
    descriptor?: {
        modIds?: string[];
    } | null;
    decision?: string | null;
    buildDecision?: string | null;
    actionStatus?: string | null;
    finalSemanticDecision?: SemanticDecision | string | null;
    arbiterDecision?: SemanticDecision | string | null;
    deepCheckDecision?: SemanticDecision | string | null;
    dependencyAdjusted?: boolean;
}

export interface ValidationStageResult {
    validation: ValidationResult;
}
