const { confidenceRank } = require('../classification/engine-result');
const { ARBITER_BUILD_ACTIONS, ARBITER_CONFIDENCE, ARBITER_DECISIONS, ARBITER_PROFILES, STRONG_ENGINE_CONFIDENCE } = require('./constants');
const { resolveDefaultBuildAction } = require('./profiles');

import type { ArbiterInput, ArbiterResult, ArbiterSummary } from '../types/arbiter';
import type { EngineEvidence, EngineResult } from '../types/classification';

const ENGINE_PRIORITY = ['probe-knowledge-engine', 'metadata-engine', 'forge-bytecode-engine', 'client-signature-engine', 'forge-semantic-engine', 'dependency-role-engine', 'registry-engine', 'filename-engine'];
const BLOCKING_FINDING_TYPES = new Set(['missing-required', 'provider-ambiguous', 'incompatibility']);

function chooseBestResult(results: EngineResult[] = [], decision: string): EngineResult | null {
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

function listEngineNames(results: EngineResult[] = [], decisionFilter: string | null = null): string[] {
    return results
        .filter((result) => !decisionFilter || result.decision === decisionFilter)
        .map((result) => result.engine);
}

function createArbiterResult({
    finalDecision,
    finalConfidence,
    reason,
    reasons = [],
    decisionOrigin,
    recommendedBuildAction,
    requiresReview = false,
    requiresDeepCheck = false,
    conflictingSignals = null,
    winningEvidence = [],
    profileDrivenAdjustment = false
}: {
    finalDecision: ArbiterResult['finalDecision'];
    finalConfidence: ArbiterResult['finalConfidence'];
    reason: string;
    reasons?: string[];
    decisionOrigin: string;
    recommendedBuildAction: ArbiterResult['recommendedBuildAction'];
    requiresReview?: boolean;
    requiresDeepCheck?: boolean;
    conflictingSignals?: ArbiterResult['conflictingSignals'] | null;
    winningEvidence?: EngineEvidence[];
    profileDrivenAdjustment?: boolean;
}): ArbiterResult {
    return {
        finalDecision,
        finalConfidence,
        reason,
        reasons,
        decisionOrigin,
        recommendedBuildAction,
        requiresReview,
        requiresDeepCheck,
        conflictingSignals: conflictingSignals || {
            keepEngines: [],
            removeEngines: []
        },
        winningEvidence,
        profileDrivenAdjustment
    };
}

function extractSignalState(input: ArbiterInput) {
    const results = input.classification ? input.classification.results || [] : [];
    const actionable = results.filter((result) => result.decision === 'keep' || result.decision === 'remove');
    const keepSignals = actionable.filter((result) => result.decision === 'keep');
    const removeSignals = actionable.filter((result) => result.decision === 'remove');
    const strongKeepSignals = keepSignals.filter((result) => STRONG_ENGINE_CONFIDENCE.has(result.confidence));
    const strongRemoveSignals = removeSignals.filter((result) => STRONG_ENGINE_CONFIDENCE.has(result.confidence));
    const bestKeep = chooseBestResult(results, 'keep');
    const bestRemove = chooseBestResult(results, 'remove');

    return {
        results,
        keepSignals,
        removeSignals,
        strongKeepSignals,
        strongRemoveSignals,
        bestKeep,
        bestRemove,
        engineErrors: results.filter((result) => result.decision === 'error')
    };
}

function extractDependencyState(input: ArbiterInput) {
    const preservedByDependency = input.dependencyAdjusted
        || input.dependencyFindings.some((finding) => finding.type === 'preserved-by-dependency');
    const blockingFindings = input.dependencyFindings.filter((finding) => BLOCKING_FINDING_TYPES.has(finding.type));

    return {
        preservedByDependency,
        blockingFindings
    };
}

function createWinningEvidence(source: { evidence?: EngineEvidence[]; reason?: string; engine?: string; type?: string } | null): EngineEvidence[] {
    if (!source) {
        return [];
    }

    if (Array.isArray(source.evidence) && source.evidence.length > 0) {
        return source.evidence;
    }

    return [
        {
            type: 'reason',
            value: source.reason || '',
            source: source.engine || source.type || null
        }
    ].filter((item) => item.value);
}

function createFindingEvidence(findings: Array<{ type: string; message: string }>): EngineEvidence[] {
    return findings.map((finding) => ({
        type: finding.type,
        value: finding.message,
        source: 'dependency-graph'
    }));
}

function maybeEscalateRemoveByProfile(profile: ArbiterInput['profile'], signal: EngineResult | null): boolean {
    if (!signal) {
        return false;
    }

    if (signal.confidence === ARBITER_CONFIDENCE.low) {
        return profile !== ARBITER_PROFILES.aggressive;
    }

    if (signal.confidence === ARBITER_CONFIDENCE.medium && signal.engine !== 'metadata-engine') {
        return profile === ARBITER_PROFILES.safe;
    }

    return false;
}

function createConflictPayload(signalState: ReturnType<typeof extractSignalState>): ArbiterResult['conflictingSignals'] {
    return {
        keepEngines: listEngineNames(signalState.strongKeepSignals),
        removeEngines: listEngineNames(signalState.strongRemoveSignals)
    };
}

function hasStrongKeepConsensus(signalState: ReturnType<typeof extractSignalState>): boolean {
    const metadataKeep = signalState.strongKeepSignals.find((result) => result.engine === 'metadata-engine');
    const registryKeep = signalState.strongKeepSignals.find((result) => result.engine === 'registry-engine');

    return Boolean(metadataKeep && registryKeep);
}

function arbitrateDecision(input: ArbiterInput): ArbiterResult {
    const profile = input.profile || ARBITER_PROFILES.balanced;
    const signalState = extractSignalState(input);
    const dependencyState = extractDependencyState(input);
    const hasStrongConflict = signalState.strongKeepSignals.length > 0 && signalState.strongRemoveSignals.length > 0;
    const hasActionableSignals = signalState.keepSignals.length > 0 || signalState.removeSignals.length > 0;
    const strongKeepConsensus = hasStrongKeepConsensus(signalState);
    const probeKnowledgeSignal = signalState.results.find((result) => (
        result.engine === 'probe-knowledge-engine'
        && (result.decision === 'keep' || result.decision === 'remove')
        && STRONG_ENGINE_CONFIDENCE.has(result.confidence)
    )) || null;

    if (dependencyState.preservedByDependency) {
        return createArbiterResult({
            finalDecision: ARBITER_DECISIONS.keep,
            finalConfidence: ARBITER_CONFIDENCE.high,
            reason: input.dependencyReason || 'Dependency graph requires keeping this jar',
            reasons: [input.dependencyReason || 'Dependency graph requires keeping this jar'],
            decisionOrigin: 'dependency-constraint',
            recommendedBuildAction: ARBITER_BUILD_ACTIONS.keep,
            winningEvidence: createFindingEvidence(
                input.dependencyFindings.filter((finding) => finding.type === 'preserved-by-dependency')
            )
        });
    }

    if (dependencyState.blockingFindings.length > 0) {
        return createArbiterResult({
            finalDecision: ARBITER_DECISIONS.review,
            finalConfidence: ARBITER_CONFIDENCE.low,
            reason: 'Dependency validation found unresolved blocking issues',
            reasons: dependencyState.blockingFindings.map((finding) => finding.message),
            decisionOrigin: 'dependency-validation',
            recommendedBuildAction: resolveDefaultBuildAction(ARBITER_DECISIONS.review, profile),
            requiresReview: true,
            requiresDeepCheck: true,
            winningEvidence: createFindingEvidence(dependencyState.blockingFindings)
        });
    }

    if (probeKnowledgeSignal) {
        return createArbiterResult({
            finalDecision: probeKnowledgeSignal.decision as ArbiterResult['finalDecision'],
            finalConfidence: probeKnowledgeSignal.confidence as ArbiterResult['finalConfidence'],
            reason: probeKnowledgeSignal.reason,
            reasons: [probeKnowledgeSignal.reason],
            decisionOrigin: `engine:${probeKnowledgeSignal.engine}`,
            recommendedBuildAction: probeKnowledgeSignal.decision === 'remove'
                ? ARBITER_BUILD_ACTIONS.exclude
                : ARBITER_BUILD_ACTIONS.keep,
            winningEvidence: createWinningEvidence(probeKnowledgeSignal)
        });
    }

    if (hasStrongConflict) {
        return createArbiterResult({
            finalDecision: ARBITER_DECISIONS.review,
            finalConfidence: ARBITER_CONFIDENCE.low,
            reason: 'Strong engines disagree on the final side of this mod',
            reasons: ['Strong engine conflict requires manual review or deep-check'],
            decisionOrigin: 'engine-conflict',
            recommendedBuildAction: resolveDefaultBuildAction(ARBITER_DECISIONS.review, profile),
            requiresReview: true,
            requiresDeepCheck: true,
            conflictingSignals: createConflictPayload(signalState),
            winningEvidence: [
                ...createWinningEvidence(signalState.bestKeep),
                ...createWinningEvidence(signalState.bestRemove)
            ]
        });
    }

    if (strongKeepConsensus && signalState.bestKeep) {
        return createArbiterResult({
            finalDecision: ARBITER_DECISIONS.keep,
            finalConfidence: signalState.bestKeep.confidence,
            reason: 'Metadata and registry strongly agree that this mod should be kept',
            reasons: signalState.strongKeepSignals.map((result) => result.reason),
            decisionOrigin: 'engine-consensus',
            recommendedBuildAction: ARBITER_BUILD_ACTIONS.keep,
            winningEvidence: signalState.strongKeepSignals.flatMap((result) => createWinningEvidence(result))
        });
    }

    if (signalState.bestRemove) {
        if (maybeEscalateRemoveByProfile(profile, signalState.bestRemove)) {
            return createArbiterResult({
                finalDecision: ARBITER_DECISIONS.review,
                finalConfidence: ARBITER_CONFIDENCE.low,
                reason: `Profile ${profile} escalated a risky remove decision into review`,
                reasons: [signalState.bestRemove.reason],
                decisionOrigin: 'profile-escalation',
                recommendedBuildAction: resolveDefaultBuildAction(ARBITER_DECISIONS.review, profile),
                requiresReview: true,
                requiresDeepCheck: signalState.bestRemove.engine === 'filename-engine',
                profileDrivenAdjustment: true,
                winningEvidence: createWinningEvidence(signalState.bestRemove)
            });
        }

        return createArbiterResult({
            finalDecision: ARBITER_DECISIONS.remove,
            finalConfidence: signalState.bestRemove.confidence,
            reason: signalState.bestRemove.reason,
            reasons: [signalState.bestRemove.reason],
            decisionOrigin: `engine:${signalState.bestRemove.engine}`,
            recommendedBuildAction: ARBITER_BUILD_ACTIONS.exclude,
            winningEvidence: createWinningEvidence(signalState.bestRemove)
        });
    }

    if (signalState.bestKeep) {
        return createArbiterResult({
            finalDecision: ARBITER_DECISIONS.keep,
            finalConfidence: signalState.bestKeep.confidence,
            reason: signalState.bestKeep.reason,
            reasons: [signalState.bestKeep.reason],
            decisionOrigin: `engine:${signalState.bestKeep.engine}`,
            recommendedBuildAction: ARBITER_BUILD_ACTIONS.keep,
            winningEvidence: createWinningEvidence(signalState.bestKeep)
        });
    }

    if (signalState.engineErrors.length > 0 && !hasActionableSignals) {
        return createArbiterResult({
            finalDecision: ARBITER_DECISIONS.review,
            finalConfidence: ARBITER_CONFIDENCE.low,
            reason: 'No stable classification signal was produced because engine errors occurred',
            reasons: signalState.engineErrors.map((result) => result.reason),
            decisionOrigin: 'engine-error',
            recommendedBuildAction: resolveDefaultBuildAction(ARBITER_DECISIONS.review, profile),
            requiresReview: true,
            requiresDeepCheck: false,
            winningEvidence: signalState.engineErrors.map((result) => ({
                type: 'engine-error',
                value: result.reason,
                source: result.engine
            }))
        });
    }

    return createArbiterResult({
        finalDecision: ARBITER_DECISIONS.keep,
        finalConfidence: ARBITER_CONFIDENCE.low,
        reason: 'No strong remove signal was produced; kept conservatively',
        reasons: ['No decisive remove signal'],
        decisionOrigin: 'conservative-default',
        recommendedBuildAction: ARBITER_BUILD_ACTIONS.keep,
        winningEvidence: []
    });
}

function buildArbiterStats(decisions: Array<{ arbiter?: ArbiterResult | null; decision?: string }>, profile: ArbiterSummary['profile']): ArbiterSummary {
    const summary: ArbiterSummary = {
        profile,
        finalDecisions: {
            keep: 0,
            remove: 0,
            review: 0
        },
        confidence: {
            high: 0,
            medium: 0,
            low: 0,
            none: 0
        },
        requiresDeepCheck: 0,
        reviewKeptInBuild: 0,
        reviewExcludedInBuild: 0,
        profileDrivenAdjustments: 0
    };

    for (const decision of decisions) {
        const arbiter = decision.arbiter;

        if (!arbiter) {
            continue;
        }

        summary.finalDecisions[arbiter.finalDecision] += 1;
        summary.confidence[arbiter.finalConfidence] += 1;

        if (arbiter.requiresDeepCheck) {
            summary.requiresDeepCheck += 1;
        }

        if (arbiter.profileDrivenAdjustment) {
            summary.profileDrivenAdjustments += 1;
        }

        if (arbiter.finalDecision === ARBITER_DECISIONS.review) {
            if (decision.decision === 'keep') {
                summary.reviewKeptInBuild += 1;
            } else {
                summary.reviewExcludedInBuild += 1;
            }
        }
    }

    return summary;
}

module.exports = {
    arbitrateDecision,
    buildArbiterStats,
    createArbiterResult
};
