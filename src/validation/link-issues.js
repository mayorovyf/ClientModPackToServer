function normalizeValue(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeFileHint(value) {
    return normalizeValue(value).replace(/\\/g, '/');
}

function isRemovalDecision(decision) {
    return decision.actionStatus === 'excluded'
        || decision.actionStatus === 'would-exclude'
        || decision.buildDecision === 'exclude'
        || decision.semanticDecision === 'remove';
}

function buildIndexes(decisions) {
    const byModId = new Map();
    const byFileName = new Map();

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

            byModId.get(normalized).push(decision);
        }
    }

    return {
        byModId,
        byFileName
    };
}

function matchDecisionByJarHint(hint, indexes) {
    const normalizedHint = normalizeFileHint(hint);

    if (indexes.byFileName.has(normalizedHint)) {
        return indexes.byFileName.get(normalizedHint);
    }

    for (const [fileName, decision] of indexes.byFileName.entries()) {
        if (fileName.includes(normalizedHint) || normalizedHint.includes(fileName)) {
            return decision;
        }
    }

    return null;
}

function serializeLinkedDecision(decision, matchedBy) {
    return {
        fileName: decision.fileName,
        matchedBy,
        buildDecision: decision.decision,
        actionStatus: decision.actionStatus,
        semanticDecision: decision.finalSemanticDecision,
        arbiterDecision: decision.arbiterDecision,
        deepCheckDecision: decision.deepCheckDecision,
        dependencyAdjusted: Boolean(decision.dependencyAdjusted),
        modIds: decision.descriptor ? decision.descriptor.modIds : []
    };
}

function linkValidationIssues({ issues = [], decisions = [] }) {
    const indexes = buildIndexes(decisions);
    const suspectedFalseRemovalMap = new Map();
    const linkedIssues = issues.map((issue) => {
        const linkedDecisions = [];
        const seenFiles = new Set();
        const primaryIds = issue.suspectedModIds && issue.suspectedModIds.length > 0
            ? issue.suspectedModIds
            : issue.modIds;

        for (const modId of primaryIds || []) {
            const matches = indexes.byModId.get(normalizeValue(modId)) || [];

            for (const decision of matches) {
                if (seenFiles.has(decision.fileName)) {
                    continue;
                }

                seenFiles.add(decision.fileName);
                linkedDecisions.push(serializeLinkedDecision(decision, 'modId'));
            }
        }

        for (const hint of issue.jarHints || []) {
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
                reason: issue.message
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
