const { CONFIDENCE_LEVELS, ENGINE_DECISIONS } = require('./constants');
const { confidenceRank } = require('./engine-result');

import type {
    ClassificationConflict,
    ClassificationStats,
    EngineResult,
    FinalClassification,
    RoleSignal,
    RoleType
} from '../types/classification';

const STRONG_CONFIDENCE = new Set([CONFIDENCE_LEVELS.high, CONFIDENCE_LEVELS.medium]);
const ENGINE_PRIORITY = ['probe-knowledge-engine', 'metadata-engine', 'forge-bytecode-engine', 'client-signature-engine', 'forge-semantic-engine', 'dependency-role-engine', 'registry-engine', 'filename-engine'];
const ROLE_TYPES: RoleType[] = [
    'client-ui',
    'client-visual',
    'client-qol',
    'client-library',
    'common-library',
    'common-gameplay',
    'common-optimization',
    'compat-client',
    'unknown'
];

function isStrong(result: EngineResult): boolean {
    return STRONG_CONFIDENCE.has(result.confidence);
}

function chooseBestResult(results: EngineResult[], decision: string): EngineResult | null {
    return results
        .filter((result) => result.decision === decision)
        .sort((left, right) => {
            const confidenceDiff = confidenceRank(right.confidence) - confidenceRank(left.confidence);

            if (confidenceDiff !== 0) {
                return confidenceDiff;
            }

            const leftPriority = ENGINE_PRIORITY.indexOf(left.engine);
            const rightPriority = ENGINE_PRIORITY.indexOf(right.engine);

            return (leftPriority === -1 ? 999 : leftPriority) - (rightPriority === -1 ? 999 : rightPriority);
        })[0] || null;
}

function buildConflict(results: EngineResult[]): ClassificationConflict {
    const keepEngines = results.filter((result) => result.decision === ENGINE_DECISIONS.keep).map((result) => result.engine);
    const removeEngines = results.filter((result) => result.decision === ENGINE_DECISIONS.remove).map((result) => result.engine);

    return {
        hasConflict: keepEngines.length > 0 && removeEngines.length > 0,
        keepEngines,
        removeEngines
    };
}

function toRoleSignal(result: EngineResult): RoleSignal | null {
    if (!result.roleType || result.roleType === 'unknown') {
        return null;
    }

    return {
        engine: result.engine,
        roleType: result.roleType,
        confidence: result.roleConfidence,
        reason: result.roleReason || result.reason
    };
}

function chooseBestRoleSignal(results: EngineResult[]): RoleSignal | null {
    return results
        .map((result) => toRoleSignal(result))
        .filter((signal): signal is RoleSignal => Boolean(signal))
        .sort((left, right) => {
            const confidenceDiff = confidenceRank(right.confidence) - confidenceRank(left.confidence);

            if (confidenceDiff !== 0) {
                return confidenceDiff;
            }

            const leftPriority = ENGINE_PRIORITY.indexOf(left.engine);
            const rightPriority = ENGINE_PRIORITY.indexOf(right.engine);

            return (leftPriority === -1 ? 999 : leftPriority) - (rightPriority === -1 ? 999 : rightPriority);
        })[0] || null;
}

function buildRoleSignals(results: EngineResult[]): RoleSignal[] {
    return results
        .map((result) => toRoleSignal(result))
        .filter((signal): signal is RoleSignal => Boolean(signal));
}

function roleFamily(roleType: RoleType): 'client' | 'common' | 'compat' | 'unknown' {
    if (roleType.startsWith('client-')) {
        return 'client';
    }

    if (roleType.startsWith('common-')) {
        return 'common';
    }

    if (roleType === 'compat-client') {
        return 'compat';
    }

    return 'unknown';
}

function resolveFinalRole(results: EngineResult[]): Pick<FinalClassification, 'finalRoleType' | 'roleConfidence' | 'roleReason' | 'roleOrigin' | 'roleSignals'> {
    const roleSignals = buildRoleSignals(results);
    const strongFamilies = new Set(
        results
            .filter((result) => STRONG_CONFIDENCE.has(result.roleConfidence) && result.roleType !== 'unknown')
            .map((result) => roleFamily(result.roleType))
            .filter((family) => family !== 'unknown')
    );

    if (strongFamilies.has('client') && strongFamilies.has('common')) {
        return {
            finalRoleType: 'unknown',
            roleConfidence: CONFIDENCE_LEVELS.low,
            roleReason: 'Role signals conflict between client and common classifications',
            roleOrigin: null,
            roleSignals
        };
    }

    const bestRoleSignal = chooseBestRoleSignal(results);

    return {
        finalRoleType: bestRoleSignal ? bestRoleSignal.roleType : 'unknown',
        roleConfidence: bestRoleSignal ? bestRoleSignal.confidence : CONFIDENCE_LEVELS.none,
        roleReason: bestRoleSignal ? bestRoleSignal.reason : null,
        roleOrigin: bestRoleSignal ? bestRoleSignal.engine : null,
        roleSignals
    };
}

function createFinalClassification({
    finalDecision,
    confidence,
    reason,
    winningEngine,
    matchedRule = null,
    matchedRuleSource = null,
    finalRoleType = 'unknown',
    roleConfidence = CONFIDENCE_LEVELS.none,
    roleReason = null,
    roleOrigin = null,
    roleSignals = [],
    usedFallback = false,
    conflict = null,
    results = []
}: {
    finalDecision: 'keep' | 'remove';
    confidence: EngineResult['confidence'];
    reason: string;
    winningEngine: string | null;
    matchedRule?: string | null;
    matchedRuleSource?: string | null;
    finalRoleType?: FinalClassification['finalRoleType'];
    roleConfidence?: FinalClassification['roleConfidence'];
    roleReason?: FinalClassification['roleReason'];
    roleOrigin?: FinalClassification['roleOrigin'];
    roleSignals?: FinalClassification['roleSignals'];
    usedFallback?: boolean;
    conflict?: ClassificationConflict | null;
    results?: EngineResult[];
}): FinalClassification {
    return {
        finalDecision,
        confidence,
        reason,
        winningEngine,
        matchedRule,
        matchedRuleSource,
        finalRoleType,
        roleConfidence,
        roleReason,
        roleOrigin,
        roleSignals,
        usedFallback,
        conflict: conflict || {
            hasConflict: false,
            keepEngines: [],
            removeEngines: []
        },
        results
    };
}

function mergeClassificationResults(results: EngineResult[]): FinalClassification {
    const actionable = results.filter((result) => result.decision === ENGINE_DECISIONS.keep || result.decision === ENGINE_DECISIONS.remove);
    const conflict = buildConflict(actionable);
    const roleState = resolveFinalRole(results);
    const probeKnowledgeRemove = results.find((result) => result.engine === 'probe-knowledge-engine' && result.decision === ENGINE_DECISIONS.remove && isStrong(result));
    const probeKnowledgeKeep = results.find((result) => result.engine === 'probe-knowledge-engine' && result.decision === ENGINE_DECISIONS.keep && isStrong(result));
    const metadataRemove = results.find((result) => result.engine === 'metadata-engine' && result.decision === ENGINE_DECISIONS.remove && isStrong(result));
    const metadataKeep = results.find((result) => result.engine === 'metadata-engine' && result.decision === ENGINE_DECISIONS.keep && isStrong(result));
    const forgeBytecodeRemove = results.find((result) => result.engine === 'forge-bytecode-engine' && result.decision === ENGINE_DECISIONS.remove && isStrong(result));
    const forgeBytecodeKeep = results.find((result) => result.engine === 'forge-bytecode-engine' && result.decision === ENGINE_DECISIONS.keep && isStrong(result));
    const clientSignatureRemove = results.find((result) => result.engine === 'client-signature-engine' && result.decision === ENGINE_DECISIONS.remove && isStrong(result));
    const clientSignatureKeep = results.find((result) => result.engine === 'client-signature-engine' && result.decision === ENGINE_DECISIONS.keep && isStrong(result));
    const forgeSemanticRemove = results.find((result) => result.engine === 'forge-semantic-engine' && result.decision === ENGINE_DECISIONS.remove && isStrong(result));
    const forgeSemanticKeep = results.find((result) => result.engine === 'forge-semantic-engine' && result.decision === ENGINE_DECISIONS.keep && isStrong(result));
    const dependencyRoleRemove = results.find((result) => result.engine === 'dependency-role-engine' && result.decision === ENGINE_DECISIONS.remove && isStrong(result));
    const dependencyRoleKeep = results.find((result) => result.engine === 'dependency-role-engine' && result.decision === ENGINE_DECISIONS.keep && isStrong(result));
    const registryRemove = results.find((result) => result.engine === 'registry-engine' && result.decision === ENGINE_DECISIONS.remove && isStrong(result));
    const registryKeep = results.find((result) => result.engine === 'registry-engine' && result.decision === ENGINE_DECISIONS.keep && isStrong(result));
    const filenameRemove = results.find((result) => result.engine === 'filename-engine' && result.decision === ENGINE_DECISIONS.remove);
    const bestKeep = chooseBestResult(results, ENGINE_DECISIONS.keep);
    const engineErrors = results.filter((result) => result.decision === ENGINE_DECISIONS.error);

    if (probeKnowledgeRemove || probeKnowledgeKeep) {
        const winner = probeKnowledgeRemove || probeKnowledgeKeep;

        return createFinalClassification({
            finalDecision: (winner as EngineResult).decision as 'keep' | 'remove',
            confidence: (winner as EngineResult).confidence,
            reason: (winner as EngineResult).reason,
            winningEngine: (winner as EngineResult).engine,
            matchedRule: (winner as EngineResult).matchedRule,
            matchedRuleSource: (winner as EngineResult).matchedRuleSource,
            ...roleState,
            usedFallback: false,
            conflict,
            results
        });
    }

    if (conflict.hasConflict) {
        const winner = bestKeep || chooseBestResult(results, ENGINE_DECISIONS.remove);

        return createFinalClassification({
            finalDecision: ENGINE_DECISIONS.keep,
            confidence: winner ? winner.confidence : CONFIDENCE_LEVELS.low,
            reason: 'Conflicting engine results were detected; the mod was kept conservatively',
            winningEngine: winner ? winner.engine : null,
            matchedRule: winner ? winner.matchedRule : null,
            matchedRuleSource: winner ? winner.matchedRuleSource : null,
            ...roleState,
            usedFallback: false,
            conflict,
            results
        });
    }

    for (const winner of [probeKnowledgeRemove, probeKnowledgeKeep, metadataRemove, metadataKeep, forgeBytecodeRemove, forgeBytecodeKeep, clientSignatureRemove, clientSignatureKeep, forgeSemanticRemove, forgeSemanticKeep, dependencyRoleRemove, dependencyRoleKeep, registryRemove, registryKeep, filenameRemove]) {
        if (!winner) {
            continue;
        }

        return createFinalClassification({
            finalDecision: winner.decision as 'keep' | 'remove',
            confidence: winner.confidence,
            reason: winner.reason,
            winningEngine: winner.engine,
            matchedRule: winner.matchedRule,
            matchedRuleSource: winner.matchedRuleSource,
            ...roleState,
            usedFallback: winner.engine === 'filename-engine',
            results
        });
    }

    return createFinalClassification({
        finalDecision: ENGINE_DECISIONS.keep,
        confidence: bestKeep ? bestKeep.confidence : engineErrors.length > 0 ? CONFIDENCE_LEVELS.low : CONFIDENCE_LEVELS.none,
        reason: engineErrors.length > 0
            ? 'No decisive engine result was produced; the mod was kept conservatively after engine errors'
            : 'No engine produced a decisive removal signal; the mod was kept conservatively',
        winningEngine: bestKeep ? bestKeep.engine : null,
        matchedRule: bestKeep ? bestKeep.matchedRule : null,
        matchedRuleSource: bestKeep ? bestKeep.matchedRuleSource : null,
        ...roleState,
        usedFallback: true,
        results
    });
}

function buildClassificationStats(
    decisions: Array<{ classification?: FinalClassification | null }>,
    enabledEngines: string[] = []
): ClassificationStats {
    const byEngine = Object.fromEntries(
        enabledEngines.map((engineName) => [
            engineName,
            {
                keep: 0,
                remove: 0,
                unknown: 0,
                error: 0
            }
        ])
    ) as ClassificationStats['byEngine'];

    const summary: ClassificationStats = {
        enabledEngines,
        finalDecisions: {
            keep: 0,
            remove: 0
        },
        conflicts: 0,
        fallbackFinalDecisions: 0,
        filesWithEngineErrors: 0,
        roleTypes: Object.fromEntries(ROLE_TYPES.map((roleType) => [roleType, 0])) as ClassificationStats['roleTypes'],
        byEngine
    };

    for (const decision of decisions) {
        const classification = decision.classification;

        if (!classification) {
            continue;
        }

        if (classification.finalDecision === ENGINE_DECISIONS.remove) {
            summary.finalDecisions.remove += 1;
        } else {
            summary.finalDecisions.keep += 1;
        }

        if (classification.usedFallback) {
            summary.fallbackFinalDecisions += 1;
        }

        if (classification.conflict && classification.conflict.hasConflict) {
            summary.conflicts += 1;
        }

        if (classification.results.some((result) => result.decision === ENGINE_DECISIONS.error)) {
            summary.filesWithEngineErrors += 1;
        }

        summary.roleTypes[classification.finalRoleType] += 1;

        for (const result of classification.results) {
            let engineSummary = summary.byEngine[result.engine];

            if (!engineSummary) {
                engineSummary = {
                    keep: 0,
                    remove: 0,
                    unknown: 0,
                    error: 0
                };
                summary.byEngine[result.engine] = engineSummary;
            }

            engineSummary[result.decision] += 1;
        }
    }

    return summary;
}

module.exports = {
    buildClassificationStats,
    mergeClassificationResults
};
