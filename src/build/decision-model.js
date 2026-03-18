function createFileDecision({ fileName, sourcePath, descriptor = null, classification = null }) {
    const finalDecision = classification ? classification.finalDecision : 'keep';
    const shouldExclude = finalDecision === 'remove';
    const classificationDecision = shouldExclude ? 'exclude' : 'keep';
    const classificationReason = classification ? classification.reason : 'No classification result was produced';

    return {
        fileName,
        sourcePath,
        descriptor,
        classification,
        classificationDecision,
        classificationReason,
        decision: classificationDecision,
        reason: classificationReason,
        decisionOrigin: 'classification',
        matchedRule: classification ? classification.matchedRule : null,
        matchedRuleSource: classification ? classification.matchedRuleSource : null,
        dependencyAdjusted: false,
        dependencyReason: null,
        dependencyFindings: [],
        dependencyDependencies: {
            required: [],
            optional: [],
            incompatibilities: []
        },
        dependencyDependents: {
            requiredBy: [],
            optionalBy: [],
            incompatibleWith: []
        },
        arbiter: null,
        arbiterDecision: null,
        arbiterConfidence: null,
        arbiterReasons: [],
        arbiterWinningEvidence: [],
        finalSemanticDecision: finalDecision === 'remove' ? 'remove' : 'keep',
        finalConfidence: classification ? classification.confidence : null,
        finalDecisionOrigin: 'classification',
        finalReasons: classification ? [classification.reason] : [],
        requiresReview: false,
        requiresDeepCheck: false,
        deepCheck: null,
        deepCheckStatus: null,
        deepCheckDecision: null,
        deepCheckConfidence: null,
        deepCheckChangedDecision: false,
        actionStatus: shouldExclude ? 'excluded' : 'pending',
        destinationPath: null,
        error: null
    };
}

function finalizeDecision(decision, updates = {}) {
    return {
        ...decision,
        ...updates
    };
}

module.exports = {
    createFileDecision,
    finalizeDecision
};
