const { findProbeKnowledgeMatch } = require('./knowledge-store');

import type { ProbeKnowledgeFile, ProbePlanStep } from '../types/probe';

function isReviewDecision(decision: Record<string, any>): boolean {
    const semanticDecision = decision.finalSemanticDecision || decision.arbiterDecision || null;
    return semanticDecision === 'review' || decision.requiresReview === true;
}

function baseRolePriority(roleType: string | null | undefined): number {
    switch (roleType) {
        case 'client-ui':
            return 80;
        case 'client-visual':
            return 76;
        case 'client-qol':
            return 72;
        case 'client-library':
            return 68;
        case 'compat-client':
            return 64;
        case 'unknown':
            return 44;
        case 'common-library':
        case 'common-gameplay':
        case 'common-optimization':
        default:
            return 20;
    }
}

function confidencePriority(confidence: string | null | undefined): number {
    switch (confidence) {
        case 'high':
            return 18;
        case 'medium':
            return 12;
        case 'low':
            return 6;
        default:
            return 0;
    }
}

function buildDecisionMap(decisions: Array<Record<string, any>>): Map<string, Record<string, any>> {
    return new Map(decisions.map((decision) => [decision.fileName, decision]));
}

function collectRequiredSupportFiles(
    fileName: string,
    decisionMap: Map<string, Record<string, any>>,
    visited = new Set<string>()
): string[] {
    const decision = decisionMap.get(fileName);

    if (!decision || visited.has(fileName)) {
        return [];
    }

    visited.add(fileName);
    const required = decision.dependencyDependencies?.required || [];
    const supportFiles = new Set<string>();

    for (const entry of required) {
        for (const provider of entry.providerDecisionStates || []) {
            if (!provider || provider.decision === 'exclude' || provider.fileName === fileName) {
                continue;
            }

            supportFiles.add(provider.fileName);

            for (const nestedProvider of collectRequiredSupportFiles(provider.fileName, decisionMap, visited)) {
                supportFiles.add(nestedProvider);
            }
        }
    }

    return [...supportFiles].sort((left, right) => left.localeCompare(right));
}

function candidatePriority(decision: Record<string, any>, supportCount: number): number {
    const signatureKinds = new Set(decision.descriptor?.archiveIndex?.clientSignatures?.signatureKinds || []);
    const hintCategories = new Set(decision.descriptor?.archiveIndex?.hintCategories || []);
    let priority = 0;

    priority += baseRolePriority(decision.finalRoleType);
    priority += confidencePriority(decision.finalConfidence);
    priority += Math.min(supportCount, 5);

    if (signatureKinds.has('forge-client-event')) {
        priority += 12;
    }

    if (signatureKinds.has('gui-api') || signatureKinds.has('render-api')) {
        priority += 10;
    }

    if (signatureKinds.has('service-client-adapter')) {
        priority += 8;
    }

    if (hintCategories.has('library')) {
        priority += 6;
    }

    if (decision.deepCheckStatus === 'review') {
        priority += 4;
    }

    return priority;
}

function createProbePlan({
    decisions,
    knowledge,
    maxMods,
    mode
}: {
    decisions: Array<Record<string, any>>;
    knowledge: ProbeKnowledgeFile;
    maxMods: number;
    mode: 'off' | 'auto' | 'force';
}): ProbePlanStep[] {
    const decisionMap = buildDecisionMap(decisions);

    return decisions
        .filter((decision) => isReviewDecision(decision) && decision.descriptor && decision.sourcePath)
        .map((decision) => {
            const knowledgeMatch = findProbeKnowledgeMatch({
                descriptor: decision.descriptor,
                knowledge
            });
            const requiredSupportFiles = collectRequiredSupportFiles(decision.fileName, decisionMap);
            const priority = candidatePriority(decision, requiredSupportFiles.length);

            return {
                decision,
                knowledgeMatch,
                requiredSupportFiles,
                priority
            };
        })
        .filter((candidate) => {
            if (!candidate.knowledgeMatch) {
                return true;
            }

            if (mode === 'force') {
                return true;
            }

            return candidate.knowledgeMatch.entry.semanticDecision === 'unknown';
        })
        .sort((left, right) => right.priority - left.priority || left.decision.fileName.localeCompare(right.decision.fileName))
        .slice(0, Math.max(0, maxMods))
        .map((candidate, index) => ({
            id: `probe-${index + 1}`,
            fileName: candidate.decision.fileName,
            sourcePath: candidate.decision.sourcePath,
            requiredSupportFiles: candidate.requiredSupportFiles,
            roleHint: candidate.decision.finalRoleType || 'unknown',
            confidenceHint: candidate.decision.finalConfidence || 'none',
            priority: candidate.priority
        }));
}

module.exports = {
    createProbePlan
};
