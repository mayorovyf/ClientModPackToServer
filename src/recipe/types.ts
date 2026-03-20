import type { TerminalOutcomeId } from '../types/outcome';
import type { CandidateFingerprint, AppliedFix } from '../convergence/types';

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

export interface MinimalRecipe {
    schemaVersion: '1.0';
    sourceRunId: string;
    inputFingerprint: CandidateFingerprint;
    selectedLoader: string | null;
    selectedCore: string | null;
    selectedJavaProfile: string | null;
    launchProfile: {
        validationEntrypointKind: string | null;
        validationEntrypointPath: string | null;
    };
    decisions: MinimalRecipeDecisionSet;
    appliedFixes: AppliedFix[];
    candidateIds: string[];
    finalOutcome: MinimalRecipeOutcome;
}
