import type { TerminalOutcomeId } from '../types/outcome';
import type { CandidateFingerprint, AppliedFix } from '../convergence/types';
import type { RuntimeTopologyId, TopologyArtifactPartitionKind } from '../types/topology';

export interface MinimalRecipeDecisionSet {
    keep: string[];
    remove: string[];
    add: string[];
}

export interface MinimalRecipeOutcome {
    status: 'provisional' | 'resolved';
    terminalOutcomeId: TerminalOutcomeId | null;
    explanation: string;
}

export interface MinimalRecipeArtifactDecision {
    fileName: string;
    buildDecision: 'keep' | 'exclude' | null;
    actionStatus: string | null;
    topologyPartition: TopologyArtifactPartitionKind | null;
    topologyReason: string | null;
}

export interface MinimalRecipe {
    schemaVersion: '1.0';
    sourceRunId: string;
    inputFingerprint: CandidateFingerprint;
    selectedRuntimeTopologyId: RuntimeTopologyId | null;
    selectedLoader: string | null;
    selectedCore: string | null;
    selectedJavaProfile: string | null;
    launchProfile: {
        validationEntrypointKind: string | null;
        validationEntrypointPath: string | null;
    };
    decisions: MinimalRecipeDecisionSet;
    artifactDecisions: MinimalRecipeArtifactDecision[];
    appliedFixes: AppliedFix[];
    candidateIds: string[];
    finalOutcome: MinimalRecipeOutcome;
}
