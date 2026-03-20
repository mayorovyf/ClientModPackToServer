import type { RegistryRuntimeState } from './registry';
import type { ProbeKnowledgeFile } from './probe';
import type { RunReport } from './report';
import type { RunContext } from './run';

export interface ApplicationLogger {
    raw: (message?: string) => void;
    hint: (message: string) => void;
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
    debug: (message: string) => void;
    report: (message: string) => void;
    success: (message: string, label?: string) => void;
    paint: (text: string, color?: string) => string;
    canLog: (level: string) => boolean;
    withContext: (context: string) => ApplicationLogger;
}

export interface ProgressStageEvent {
    stage: string;
    [key: string]: unknown;
}

export interface ProgressModEvent {
    fileName: string;
    descriptor?: {
        loader?: string;
        modIds?: string[];
        declaredSide?: string;
        parsingWarnings?: unknown[];
        parsingErrors?: unknown[];
    } | null;
    classification?: {
        finalDecision?: string;
        confidence?: string;
        winningEngine?: string | null;
        conflict?: {
            hasConflict?: boolean;
        } | null;
    } | null;
    [key: string]: unknown;
}

export interface ProgressBuildActionEvent {
    fileName: string;
    decision?: string;
    actionStatus?: string | null;
    finalSemanticDecision?: string | null;
    finalConfidence?: string | null;
    decisionOrigin?: string | null;
    destinationPath?: string | null;
    error?: {
        code?: string | null;
        message?: string | null;
    } | null;
    [key: string]: unknown;
}

export interface ProgressConvergenceEvent {
    candidateId?: string | null;
    parentCandidateId?: string | null;
    nextCandidateId?: string | null;
    iteration?: number | null;
    nextIteration?: number | null;
    loopStage?: string | null;
    failureFamily?: string | null;
    outcomeStatus?: string | null;
    stateDigest?: string | null;
    appliedFixKinds?: string[];
    newlyAppliedFixKinds?: string[];
    terminalOutcomeId?: string | null;
    terminalOutcomeExplanation?: string | null;
    reasonCode?: string | null;
    candidateCount?: number | null;
    searchBudget?: {
        consumedCandidateStates?: number;
        consumedRetries?: number;
        consumedGuardedFixes?: number;
        consumedWallClockMs?: number;
        exhausted?: boolean;
    } | null;
    [key: string]: unknown;
}

export interface BuildProgressReporter {
    onStageStarted: (event: ProgressStageEvent) => void;
    onStageCompleted: (event: ProgressStageEvent) => void;
    onModParsed: (event: ProgressModEvent) => void;
    onBuildActionCompleted: (event: ProgressBuildActionEvent) => void;
    onConvergenceCandidateStarted: (event: ProgressConvergenceEvent) => void;
    onConvergencePlanSelected: (event: ProgressConvergenceEvent) => void;
    onConvergenceCandidateCompleted: (event: ProgressConvergenceEvent) => void;
    onConvergenceTerminalOutcome: (event: ProgressConvergenceEvent) => void;
}

export interface ClassificationContextLike {
    enabledEngines: string[];
    availableEngines?: string[];
    blockList?: string[];
    localRegistry?: {
        filePath?: string | null;
        rules?: unknown[];
    } | null;
    probeKnowledge?: {
        filePath?: string | null;
        entries?: ProbeKnowledgeFile['entries'];
    } | null;
}

export interface RegistryRuntimeBundle {
    registry: {
        filePath?: string | null;
        rules?: unknown[];
    };
    runtime: RegistryRuntimeState;
}

export interface LoadRuntimeStateResult {
    blockList: string[];
    registryRuntime: RegistryRuntimeBundle;
    probeKnowledge: {
        filePath: string | null;
        entries: ProbeKnowledgeFile['entries'];
    };
    classificationContext: ClassificationContextLike;
}

export interface PreparedRun extends LoadRuntimeStateResult {
    inputPath: string;
    instancePath: string;
    modsPath: string;
    runContext: RunContext;
    runLogger: ApplicationLogger;
}

export interface ReportFiles {
    reportDir: string;
    jsonReportPath: string;
    runMetadataPath: string;
    summaryPath: string;
    eventsLogPath: string;
    recipePath: string;
    candidatesPath: string;
}

export interface FinalizedApplicationRun {
    report: RunReport;
    reportFiles: ReportFiles;
    runContext: RunContext;
}
