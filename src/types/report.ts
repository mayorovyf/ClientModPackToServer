import type { ArbiterSummary } from './arbiter';
import type { ArchiveIndex } from './descriptor';
import type { ClassificationSnapshot, ClassificationStats, RoleSignal, RoleType } from './classification';
import type { DeepCheckResult } from './deep-check';
import type { DependencyGraphSummary } from './dependency';
import type { RegistryRuntimeState } from './registry';
import type { RunContext } from './run';
import type { ProbeSummary } from './probe';
import type { ValidationResult } from './validation';
import type { ResolvedTerminalOutcome, TerminalOutcomeContract } from './outcome';
import type { SupportBoundaryAssessment, TrustPolicyContract } from './policy';
import type { CandidateTrace } from '../convergence/types';
import type { NormalizedFailureAnalysis } from '../failure/family';
import type { MinimalRecipe } from '../recipe/types';
import type { BuildServerCoreInstallReport, PackRuntimeDetection } from './runtime-detection';
import type { RuntimeTopologyId, TopologyArtifactPartitionKind } from './topology';

export interface ReportIssue {
    fileName: string | null;
    source: string;
    code: string;
    message: string;
    fatal?: boolean;
}

export interface ReportEvent {
    timestamp: string;
    level: string;
    kind: string;
    message: string;
}

export interface ReportDecisionSummary {
    fileName: string;
    displayName?: string | null;
    modIds?: string[];
    reason: string;
    decision?: 'keep' | 'exclude' | null;
    decisionOrigin: string | null;
    arbiterDecision?: string | null;
    arbiterConfidence?: string | null;
    requiresReview: boolean;
    finalSemanticDecision: string | null;
    finalConfidence: string | null;
    finalDecisionOrigin?: string | null;
    finalRoleType?: RoleType | null;
    roleConfidence?: string | null;
    roleOrigin?: string | null;
    roleReason?: string | null;
    roleSignals?: RoleSignal[];
    deepCheckStatus?: string | null;
    deepCheckDecision?: string | null;
    actionStatus?: string | null;
    dependencyAdjusted?: boolean;
    finalReasons?: string[];
    manualReviewKey?: string | null;
    manualOverrideAction?: 'keep' | 'exclude' | null;
    manualOverrideReason?: string | null;
    manualOverrideUpdatedAt?: string | null;
    probeOutcome?: string | null;
    probeReason?: string | null;
    probeConfidence?: string | null;
    probeLogPath?: string | null;
    selectedRuntimeTopologyId?: RuntimeTopologyId | null;
    topologyPartition?: TopologyArtifactPartitionKind | null;
    topologyReason?: string | null;
    descriptor?: {
        fileName?: string;
        loader?: string;
        modIds?: string[];
        displayName?: string | null;
        version?: string | null;
        fileSha256?: string | null;
        manifestHints?: Record<string, string> | null;
        archiveIndex?: ArchiveIndex | null;
    } | null;
}

export interface RunReport {
    run: RunContext & {
        completedAt?: string | null;
        enabledEngines?: string[];
        registrySource?: string;
        registryVersion?: string;
        registryFilePath?: string | null;
        probeKnowledgePath?: string | null;
        reviewOverridesPath?: string | null;
        supportBoundaryTier?: string;
        supportBoundaryStatus?: string;
        supportBoundaryHasPendingChecks?: boolean;
        supportBoundaryTopologyId?: string | null;
        supportBoundaryTopologyAssessment?: string | null;
        primaryTerminalOutcomes?: string[];
    };
    stats: {
        totalJarFiles: number;
        kept: number;
        excluded: number;
        copied: number;
        wouldCopy: number;
        wouldExclude: number;
        errors: number;
    };
    parsing: {
        loaders: Record<string, number>;
        filesWithWarnings: number;
        filesWithErrors: number;
    };
    classification: ClassificationStats & {
        snapshots?: ClassificationSnapshot[];
    };
    dependencyGraph?: {
        status: string;
        summary: DependencyGraphSummary;
    };
    arbiter?: {
        status: string;
        summary: ArbiterSummary;
    };
    deepCheck?: {
        status: string;
        summary: {
            triggered: number;
            skipped: number;
            resolved: number;
            unresolved: number;
            failed: number;
            decisionChanged: number;
        };
        results?: DeepCheckResult[];
    };
    validation?: ValidationResult;
    probe?: ProbeSummary;
    registry?: RegistryRuntimeState;
    manualReview?: {
        overridesPath: string | null;
        totalEntries: number;
        appliedOverrides: number;
        kept: number;
        excluded: number;
    };
    releaseContract?: {
        supportBoundary: SupportBoundaryAssessment;
        trustPolicy: TrustPolicyContract;
        terminalOutcomes: TerminalOutcomeContract;
    };
    terminalOutcome?: ResolvedTerminalOutcome | null;
    failureAnalysis?: NormalizedFailureAnalysis | null;
    runtimeDetection?: PackRuntimeDetection | null;
    serverCoreInstall?: BuildServerCoreInstallReport | null;
    candidateTrace?: CandidateTrace;
    recipe?: MinimalRecipe;
    decisions?: ReportDecisionSummary[];
    warnings: ReportIssue[];
    errors: ReportIssue[];
    events: ReportEvent[];
}
