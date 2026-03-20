import type { ConfidenceLevel, EngineEvidence, FinalClassification, SemanticDecision } from './classification';
import type { ModDescriptor } from './descriptor';
import type { RuntimeTopologyId, TopologyArtifactPartitionKind } from './topology';

export type ArbiterBuildAction = 'keep' | 'exclude';
export type ArbiterProfile = 'safe' | 'balanced' | 'aggressive';

export interface ArbiterConflictSignals {
    keepEngines: string[];
    removeEngines: string[];
}

export interface ArbiterResult {
    finalDecision: Exclude<SemanticDecision, 'unknown'>;
    finalConfidence: ConfidenceLevel;
    reason: string;
    reasons: string[];
    decisionOrigin: string;
    recommendedBuildAction: ArbiterBuildAction;
    requiresReview: boolean;
    requiresDeepCheck: boolean;
    conflictingSignals: ArbiterConflictSignals;
    winningEvidence: EngineEvidence[];
    profileDrivenAdjustment: boolean;
}

export interface ArbiterInputDependencyFinding {
    type: string;
    message: string;
}

export interface ArbiterInput {
    fileName: string;
    descriptor: ModDescriptor | null;
    classification: FinalClassification | null;
    classificationDecision: string | null;
    classificationReason: string | null;
    dependencyAdjusted: boolean;
    dependencyReason: string | null;
    dependencyFindings: ArbiterInputDependencyFinding[];
    dependencyDependencies: {
        required: unknown[];
        optional: unknown[];
        incompatibilities: unknown[];
    };
    dependencyDependents: {
        requiredBy: unknown[];
        optionalBy: unknown[];
        incompatibleWith: unknown[];
    };
    selectedRuntimeTopologyId: RuntimeTopologyId | null;
    topologyPartition: TopologyArtifactPartitionKind | null;
    topologyReason: string | null;
    profile: ArbiterProfile;
}

export interface ArbiterSummary {
    profile: ArbiterProfile;
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
    requiresDeepCheck: number;
    reviewKeptInBuild: number;
    reviewExcludedInBuild: number;
    profileDrivenAdjustments: number;
}
