import type { ArbiterProfile, ArbiterResult } from './arbiter';
import type { ConfidenceLevel, EngineEvidence, FinalClassification, SemanticDecision } from './classification';
import type { DependencyFinding, DependencyIncomingSummary, DependencyOutgoingSummary } from './dependency';
import type { ModDescriptor } from './descriptor';

export type DeepCheckMode = 'auto' | 'off' | 'force';
export type DeepCheckStatus = 'skipped' | 'resolved-keep' | 'resolved-remove' | 'still-review' | 'force-manual' | 'failed';

export interface ArchiveContentAnalysis {
    totalEntries: number;
    classEntries: number;
    strongClientNamespaceHits: string[];
    weakClientPathHits: string[];
    clientResourceHits: string[];
    serverSafeHits: string[];
    warnings: string[];
}

export interface EntrypointAnalysis {
    total: number;
    clientEntrypoints: Array<Record<string, unknown>>;
    serverEntrypoints: Array<Record<string, unknown>>;
    commonEntrypoints: Array<Record<string, unknown>>;
    hasOnlyClientEntrypoints: boolean;
    hasDedicatedServerEntrypoints: boolean;
    hasSharedEntrypoints: boolean;
}

export interface MixinAnalysis {
    totalConfigs: number;
    parsedConfigs: number;
    missingConfigs: string[];
    invalidConfigs: string[];
    clientConfigNameHits: string[];
    clientPackageHits: string[];
    clientSectionHits: string[];
    clientTargetHits: string[];
    commonMixins: string[];
    warnings: string[];
    hasOnlyClientMixins: boolean;
}

export interface DeepCheckAnalysis {
    archiveContent: ArchiveContentAnalysis | null;
    entrypoints: EntrypointAnalysis | null;
    mixins: MixinAnalysis | null;
}

export interface DeepCheckError {
    code: string;
    message: string;
}

export interface DeepCheckResult {
    status: DeepCheckStatus;
    resolvedDecision: Exclude<SemanticDecision, 'unknown'> | null;
    resolvedConfidence: ConfidenceLevel;
    requiresManualReview: boolean;
    reason: string;
    reasons: string[];
    evidence: EngineEvidence[];
    triggerReasons: string[];
    warnings: string[];
    errors: DeepCheckError[];
    analysis: DeepCheckAnalysis;
}

export interface DeepCheckTrigger {
    mode: DeepCheckMode;
    shouldRun: boolean;
    mandatory: boolean;
    triggerReasons: string[];
}

export interface DeepCheckInput {
    fileName: string;
    sourcePath: string;
    descriptor: ModDescriptor | null;
    classification: FinalClassification | null;
    dependencyAdjusted: boolean;
    dependencyReason: string | null;
    dependencyFindings: DependencyFinding[];
    dependencyDependencies: DependencyOutgoingSummary;
    dependencyDependents: DependencyIncomingSummary;
    arbiter: ArbiterResult | null;
    arbiterDecision: string | null;
    arbiterConfidence: ConfidenceLevel | null;
    requiresReview: boolean;
    requiresDeepCheck: boolean;
    currentBuildDecision: string;
    currentReason: string | null;
    finalSemanticDecision: string | null;
    finalConfidence: ConfidenceLevel | null;
    finalDecisionOrigin: string | null;
    profile: ArbiterProfile;
    deepCheckMode: DeepCheckMode;
}

export interface DeepCheckSummary {
    mode: DeepCheckMode;
    triggered: number;
    skipped: number;
    resolved: number;
    unresolved: number;
    failed: number;
    decisionChanged: number;
    statuses: Record<DeepCheckStatus, number>;
    finalDecisions: {
        keep: number;
        remove: number;
        review: number;
    };
    confidence: {
        high: number;
        medium: number;
        low: number;
        none: number;
    };
}
