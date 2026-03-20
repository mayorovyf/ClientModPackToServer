import type {
    LinkedValidationDecision,
    ValidationDecisionLike,
    ValidationIssue,
    ValidationLinkResult,
    ValidationSuspectedFalseRemoval
} from '../types/validation';

function normalizeValue(value: unknown): string {
    return String(value || '').trim().toLowerCase();
}

function normalizeFileHint(value: unknown): string {
    return normalizeValue(value).replace(/\\/g, '/');
}

function isRemovalDecision(decision: LinkedValidationDecision): boolean {
    return decision.actionStatus === 'excluded'
        || decision.actionStatus === 'would-exclude'
        || decision.buildDecision === 'exclude'
        || decision.semanticDecision === 'remove';
}

function buildIndexes(decisions: ValidationDecisionLike[]): {
    byModId: Map<string, ValidationDecisionLike[]>;
    byFileName: Map<string, ValidationDecisionLike>;
} {
    const byModId = new Map<string, ValidationDecisionLike[]>();
    const byFileName = new Map<string, ValidationDecisionLike>();

    for (const decision of decisions) {
        byFileName.set(normalizeFileHint(decision.fileName), decision);

        const modIds = decision.descriptor && Array.isArray(decision.descriptor.modIds)
            ? decision.descriptor.modIds
            : [];

        for (const modId of modIds) {
            const normalized = normalizeValue(modId);

            if (!byModId.has(normalized)) {
                byModId.set(normalized, []);
            }

            byModId.get(normalized)?.push(decision);
        }
    }

    return {
        byModId,
        byFileName
    };
}

function matchDecisionByJarHint(
    hint: string,
    indexes: {
        byModId: Map<string, ValidationDecisionLike[]>;
        byFileName: Map<string, ValidationDecisionLike>;
    }
): ValidationDecisionLike | null {
    const normalizedHint = normalizeFileHint(hint);

    if (indexes.byFileName.has(normalizedHint)) {
        return indexes.byFileName.get(normalizedHint) || null;
    }

    for (const [fileName, decision] of indexes.byFileName.entries()) {
        if (fileName.includes(normalizedHint) || normalizedHint.includes(fileName)) {
            return decision;
        }
    }

    return null;
}

function serializeLinkedDecision(
    decision: ValidationDecisionLike,
    matchedBy: 'modId' | 'jarHint'
): LinkedValidationDecision {
    return {
        fileName: decision.fileName,
        matchedBy,
        buildDecision: decision.decision || decision.buildDecision || null,
        actionStatus: decision.actionStatus || null,
        semanticDecision: decision.finalSemanticDecision || null,
        arbiterDecision: decision.arbiterDecision || null,
        deepCheckDecision: decision.deepCheckDecision || null,
        dependencyAdjusted: Boolean(decision.dependencyAdjusted),
        modIds: decision.descriptor && Array.isArray(decision.descriptor.modIds) ? decision.descriptor.modIds : [],
        selectedRuntimeTopologyId: decision.selectedRuntimeTopologyId || null,
        topologyPartition: decision.topologyPartition || null,
        topologyReason: decision.topologyReason || null
    };
}

function linkValidationIssues({
    issues = [],
    decisions = []
}: {
    issues?: ValidationIssue[];
    decisions?: ValidationDecisionLike[];
} = {}): ValidationLinkResult {
    const indexes = buildIndexes(decisions);
    const suspectedFalseRemovalMap = new Map<string, ValidationSuspectedFalseRemoval>();
    const linkedIssues = issues.map((issue) => {
        const linkedDecisions: LinkedValidationDecision[] = [];
        const seenFiles = new Set<string>();
        const primaryIds = issue.suspectedModIds.length > 0 ? issue.suspectedModIds : issue.modIds;

        for (const modId of primaryIds) {
            const matches = indexes.byModId.get(normalizeValue(modId)) || [];

            for (const decision of matches) {
                if (seenFiles.has(decision.fileName)) {
                    continue;
                }

                seenFiles.add(decision.fileName);
                linkedDecisions.push(serializeLinkedDecision(decision, 'modId'));
            }
        }

        for (const hint of issue.jarHints) {
            const match = matchDecisionByJarHint(hint, indexes);

            if (!match || seenFiles.has(match.fileName)) {
                continue;
            }

            seenFiles.add(match.fileName);
            linkedDecisions.push(serializeLinkedDecision(match, 'jarHint'));
        }

        for (const linkedDecision of linkedDecisions) {
            if (!isRemovalDecision(linkedDecision)) {
                continue;
            }

            suspectedFalseRemovalMap.set(linkedDecision.fileName, {
                fileName: linkedDecision.fileName,
                matchedBy: linkedDecision.matchedBy,
                buildDecision: linkedDecision.buildDecision,
                actionStatus: linkedDecision.actionStatus,
                semanticDecision: linkedDecision.semanticDecision,
                arbiterDecision: linkedDecision.arbiterDecision,
                deepCheckDecision: linkedDecision.deepCheckDecision,
                issueKind: issue.kind,
                reason: issue.message,
                selectedRuntimeTopologyId: linkedDecision.selectedRuntimeTopologyId || null,
                topologyPartition: linkedDecision.topologyPartition || null,
                topologyReason: linkedDecision.topologyReason || null
            });
        }

        return {
            ...issue,
            linkedDecisions
        };
    });

    return {
        issues: linkedIssues,
        suspectedFalseRemovals: [...suspectedFalseRemovalMap.values()]
    };
}

module.exports = {
    linkValidationIssues
};
