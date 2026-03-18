function createArbiterInput({ decision, runContext }) {
    return {
        fileName: decision.fileName,
        descriptor: decision.descriptor,
        classification: decision.classification,
        classificationDecision: decision.classificationDecision,
        classificationReason: decision.classificationReason,
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
        profile: runContext.arbiterProfile
    };
}

module.exports = {
    createArbiterInput
};
