import type { ConfidenceLevel, FinalClassification, RoleType, SemanticDecision } from '../types/classification';
import type { RuntimeTopologyId, TopologyArtifactPartitionKind } from '../types/topology';

interface FileDecision {
    fileName: string;
    sourcePath: string;
    descriptor?: unknown;
    classification?: FinalClassification | null;
    classificationDecision: 'keep' | 'exclude';
    classificationReason: string;
    decision: 'keep' | 'exclude';
    reason: string;
    decisionOrigin: string;
    matchedRule: string | null;
    matchedRuleSource: string | null;
    dependencyAdjusted: boolean;
    dependencyReason: string | null;
    dependencyFindings: unknown[];
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
    arbiter: unknown;
    arbiterDecision: SemanticDecision | null;
    arbiterConfidence: string | null;
    arbiterReasons: string[];
    arbiterWinningEvidence: unknown[];
    finalSemanticDecision: SemanticDecision;
    finalConfidence: string | null;
    finalDecisionOrigin: string;
    finalReasons: string[];
    finalRoleType: RoleType | null;
    roleConfidence: ConfidenceLevel | null;
    roleOrigin: string | null;
    roleReason: string | null;
    requiresReview: boolean;
    requiresDeepCheck: boolean;
    deepCheck: unknown;
    deepCheckStatus: string | null;
    deepCheckDecision: SemanticDecision | null;
    deepCheckConfidence: string | null;
    deepCheckChangedDecision: boolean;
    selectedRuntimeTopologyId: RuntimeTopologyId | null;
    topologyPartition: TopologyArtifactPartitionKind | null;
    topologyReason: string | null;
    actionStatus: string;
    destinationPath: string | null;
    error: unknown;
}

function createFileDecision({
    fileName,
    sourcePath,
    descriptor = null,
    classification = null
}: {
    fileName: string;
    sourcePath: string;
    descriptor?: unknown;
    classification?: FinalClassification | null;
}): FileDecision {
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
        finalRoleType: classification ? classification.finalRoleType : 'unknown',
        roleConfidence: classification ? classification.roleConfidence : null,
        roleOrigin: classification ? classification.roleOrigin : null,
        roleReason: classification ? classification.roleReason : null,
        requiresReview: false,
        requiresDeepCheck: false,
        deepCheck: null,
        deepCheckStatus: null,
        deepCheckDecision: null,
        deepCheckConfidence: null,
        deepCheckChangedDecision: false,
        selectedRuntimeTopologyId: null,
        topologyPartition: null,
        topologyReason: null,
        actionStatus: shouldExclude ? 'excluded' : 'pending',
        destinationPath: null,
        error: null
    };
}

function finalizeDecision<T extends object, U extends object = Record<string, never>>(decision: T, updates: U = {} as U): T & U {
    return {
        ...decision,
        ...updates
    };
}

module.exports = {
    createFileDecision,
    finalizeDecision
};
