import type { DeepCheckInput } from '../types/deep-check';
import type { RunContext } from '../types/run';

function createDeepCheckInput({
    decision,
    runContext
}: {
    decision: Record<string, any>;
    runContext: RunContext;
}): DeepCheckInput {
    return {
        fileName: decision.fileName,
        sourcePath: decision.sourcePath,
        descriptor: decision.descriptor,
        classification: decision.classification,
        dependencyAdjusted: Boolean(decision.dependencyAdjusted),
        dependencyReason: decision.dependencyReason,
        dependencyFindings: Array.isArray(decision.dependencyFindings) ? decision.dependencyFindings : [],
        dependencyDependencies: decision.dependencyDependencies || {
            required: [],
            optional: [],
            incompatibilities: []
        },
        dependencyDependents: decision.dependencyDependents || {
            requiredBy: [],
            optionalBy: [],
            incompatibleWith: []
        },
        arbiter: decision.arbiter,
        arbiterDecision: decision.arbiterDecision,
        arbiterConfidence: decision.arbiterConfidence,
        requiresReview: Boolean(decision.requiresReview),
        requiresDeepCheck: Boolean(decision.requiresDeepCheck),
        currentBuildDecision: decision.decision,
        currentReason: decision.reason,
        finalSemanticDecision: decision.finalSemanticDecision,
        finalConfidence: decision.finalConfidence,
        finalDecisionOrigin: decision.finalDecisionOrigin,
        profile: runContext.arbiterProfile,
        deepCheckMode: runContext.deepCheckMode
    };
}

module.exports = {
    createDeepCheckInput
};
