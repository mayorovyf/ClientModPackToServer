const { CONFIDENCE_LEVELS, ENGINE_DECISIONS } = require('./constants');
const { confidenceRank } = require('./engine-result');

import type { ClassificationConflict, ClassificationStats, EngineResult, FinalClassification } from '../types/classification';

const STRONG_CONFIDENCE = new Set([CONFIDENCE_LEVELS.high, CONFIDENCE_LEVELS.medium]);
const ENGINE_PRIORITY = ['metadata-engine', 'registry-engine', 'filename-engine'];

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

function createFinalClassification({
    finalDecision,
    confidence,
    reason,
    winningEngine,
    matchedRule = null,
    matchedRuleSource = null,
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
    const metadataRemove = results.find((result) => result.engine === 'metadata-engine' && result.decision === ENGINE_DECISIONS.remove && isStrong(result));
    const metadataKeep = results.find((result) => result.engine === 'metadata-engine' && result.decision === ENGINE_DECISIONS.keep && isStrong(result));
    const registryRemove = results.find((result) => result.engine === 'registry-engine' && result.decision === ENGINE_DECISIONS.remove && isStrong(result));
    const registryKeep = results.find((result) => result.engine === 'registry-engine' && result.decision === ENGINE_DECISIONS.keep && isStrong(result));
    const filenameRemove = results.find((result) => result.engine === 'filename-engine' && result.decision === ENGINE_DECISIONS.remove);
    const bestKeep = chooseBestResult(results, ENGINE_DECISIONS.keep);
    const engineErrors = results.filter((result) => result.decision === ENGINE_DECISIONS.error);

    if (conflict.hasConflict) {
        const winner = bestKeep || chooseBestResult(results, ENGINE_DECISIONS.remove);

        return createFinalClassification({
            finalDecision: ENGINE_DECISIONS.keep,
            confidence: winner ? winner.confidence : CONFIDENCE_LEVELS.low,
            reason: 'Conflicting engine results were detected; the mod was kept conservatively',
            winningEngine: winner ? winner.engine : null,
            matchedRule: winner ? winner.matchedRule : null,
            matchedRuleSource: winner ? winner.matchedRuleSource : null,
            usedFallback: false,
            conflict,
            results
        });
    }

    for (const winner of [metadataRemove, metadataKeep, registryRemove, registryKeep, filenameRemove]) {
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

        for (const result of classification.results) {
            if (!summary.byEngine[result.engine]) {
                summary.byEngine[result.engine] = {
                    keep: 0,
                    remove: 0,
                    unknown: 0,
                    error: 0
                };
            }

            summary.byEngine[result.engine][result.decision] += 1;
        }
    }

    return summary;
}

module.exports = {
    buildClassificationStats,
    mergeClassificationResults
};
