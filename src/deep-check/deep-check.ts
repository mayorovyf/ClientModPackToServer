const { createArchiveHandle } = require('../jar/archive-reader');
const { ARBITER_CONFIDENCE, ARBITER_DECISIONS, ARBITER_PROFILES } = require('../arbiter/constants');
const { DEEP_CHECK_STATUSES } = require('./constants');
const { analyzeArchiveContent } = require('./analyzers/archive-content');
const { analyzeEntrypoints } = require('./analyzers/entrypoints');
const { analyzeMixins } = require('./analyzers/mixins');

import type { EngineEvidence } from '../types/classification';
import type { DeepCheckInput, DeepCheckResult } from '../types/deep-check';

function createResult({
    status,
    resolvedDecision,
    resolvedConfidence,
    reason,
    reasons = [],
    evidence = [],
    triggerReasons = [],
    warnings = [],
    errors = [],
    analysis = {}
}: {
    status: DeepCheckResult['status'];
    resolvedDecision: DeepCheckResult['resolvedDecision'];
    resolvedConfidence: DeepCheckResult['resolvedConfidence'];
    reason: string;
    reasons?: string[];
    evidence?: EngineEvidence[];
    triggerReasons?: string[];
    warnings?: string[];
    errors?: DeepCheckResult['errors'];
    analysis?: Partial<DeepCheckResult['analysis']>;
}): DeepCheckResult {
    return {
        status,
        resolvedDecision,
        resolvedConfidence,
        requiresManualReview: status === DEEP_CHECK_STATUSES.forceManual,
        reason,
        reasons,
        evidence,
        triggerReasons,
        warnings,
        errors,
        analysis: {
            archiveContent: analysis.archiveContent || null,
            entrypoints: analysis.entrypoints || null,
            mixins: analysis.mixins || null
        }
    };
}

function buildEvidence(type: string, value: string, source = 'deep-check'): EngineEvidence {
    return {
        type,
        value,
        source
    };
}

function pushReason(target: string[], value: string | null | undefined): void {
    if (value && !target.includes(value)) {
        target.push(value);
    }
}

function addScore(
    state: {
        keepScore: number;
        removeScore: number;
        keepReasons: string[];
        removeReasons: string[];
        reasons: string[];
        evidence: EngineEvidence[];
    },
    bucket: 'keep' | 'remove',
    score: number,
    reason: string,
    evidence?: EngineEvidence
): void {
    state[`${bucket}Score`] += score;
    pushReason(state[`${bucket}Reasons`], reason);
    pushReason(state.reasons, reason);

    if (evidence) {
        state.evidence.push(evidence);
    }
}

function hasDependencyPreserve(input: DeepCheckInput): boolean {
    return Boolean(input.dependencyAdjusted) || (input.dependencyFindings || []).some((finding) => finding.type === 'preserved-by-dependency');
}

function applyDeclaredSide(
    state: {
        keepScore: number;
        removeScore: number;
        keepReasons: string[];
        removeReasons: string[];
        reasons: string[];
        evidence: EngineEvidence[];
    },
    input: DeepCheckInput
): void {
    const declaredSide = input.descriptor ? input.descriptor.declaredSide : 'unknown';

    if (declaredSide === 'server') {
        addScore(state, 'keep', 4, 'Descriptor declares this jar as server-side', buildEvidence('declared-side', 'server', 'descriptor'));
        return;
    }

    if (declaredSide === 'both') {
        addScore(state, 'keep', 2, 'Descriptor declares this jar as shared/common', buildEvidence('declared-side', 'both', 'descriptor'));
        return;
    }

    if (declaredSide === 'client') {
        addScore(state, 'remove', 2, 'Descriptor declares this jar as client-side', buildEvidence('declared-side', 'client', 'descriptor'));
    }
}

function applyEntrypoints(state: any, entrypoints: DeepCheckResult['analysis']['entrypoints']): void {
    if (!entrypoints) {
        return;
    }

    if (entrypoints.hasOnlyClientEntrypoints) {
        addScore(
            state,
            'remove',
            4,
            'All discovered entrypoints are client-oriented',
            buildEvidence('entrypoints', `${entrypoints.clientEntrypoints.length} client-only`, 'entrypoints')
        );
    }

    if (entrypoints.hasDedicatedServerEntrypoints) {
        addScore(
            state,
            'keep',
            4,
            'Dedicated or server entrypoints were discovered',
            buildEvidence('entrypoints', `${entrypoints.serverEntrypoints.length} server`, 'entrypoints')
        );
    }

    if (entrypoints.hasSharedEntrypoints) {
        addScore(
            state,
            'keep',
            3,
            'Shared/common entrypoints were discovered',
            buildEvidence('entrypoints', `${entrypoints.commonEntrypoints.length} common`, 'entrypoints')
        );
    }
}

function applyMixins(state: any, mixins: DeepCheckResult['analysis']['mixins']): void {
    if (!mixins) {
        return;
    }

    if (mixins.clientTargetHits.length > 0) {
        addScore(
            state,
            'remove',
            3,
            'Mixin analysis found explicit client-side targets',
            buildEvidence('mixins', mixins.clientTargetHits[0], 'mixin-target')
        );
    }

    if (mixins.hasOnlyClientMixins) {
        addScore(
            state,
            'remove',
            3,
            'Mixin configuration appears to contain only client mixins',
            buildEvidence('mixins', 'client-only', 'mixins')
        );
    }

    if (mixins.commonMixins.length > 0) {
        addScore(
            state,
            'keep',
            2,
            'Mixin analysis found common/shared mixins',
            buildEvidence('mixins', `${mixins.commonMixins.length} common`, 'mixins')
        );
    }
}

function applyArchiveContent(state: any, archiveContent: DeepCheckResult['analysis']['archiveContent']): void {
    if (!archiveContent) {
        return;
    }

    if (archiveContent.strongClientNamespaceHits.length > 0) {
        addScore(
            state,
            'remove',
            4,
            'Archive entries reference strong client namespaces',
            buildEvidence('archive', archiveContent.strongClientNamespaceHits[0], 'archive-content')
        );
    }

    if (archiveContent.weakClientPathHits.length > 0) {
        addScore(
            state,
            'remove',
            1,
            'Archive entries contain weak client-oriented paths',
            buildEvidence('archive', archiveContent.weakClientPathHits[0], 'archive-content')
        );
    }

    if (archiveContent.clientResourceHits.length > 0) {
        addScore(
            state,
            'remove',
            1,
            'Archive resources include client-facing assets',
            buildEvidence('archive-resource', archiveContent.clientResourceHits[0], 'archive-content')
        );
    }

    if (archiveContent.serverSafeHits.length > 0) {
        addScore(
            state,
            'keep',
            2,
            'Archive entries include dedicated/server-safe paths',
            buildEvidence('archive', archiveContent.serverSafeHits[0], 'archive-content')
        );
    }
}

function resolveScoredDecision(state: any, triggerReasons: string[], analysis: DeepCheckResult['analysis']): DeepCheckResult {
    if (state.keepScore >= 4 && state.keepScore >= state.removeScore + 2) {
        return createResult({
            status: DEEP_CHECK_STATUSES.resolvedKeep,
            resolvedDecision: ARBITER_DECISIONS.keep,
            resolvedConfidence: state.keepScore >= 6 ? ARBITER_CONFIDENCE.high : ARBITER_CONFIDENCE.medium,
            reason: state.keepReasons[0] || state.reasons[0] || 'Deep-check confirmed keep',
            reasons: state.reasons,
            evidence: state.evidence,
            triggerReasons,
            warnings: analysis.mixins ? analysis.mixins.warnings : [],
            errors: [],
            analysis
        });
    }

    if (state.removeScore >= 4 && state.removeScore >= state.keepScore + 2) {
        return createResult({
            status: DEEP_CHECK_STATUSES.resolvedRemove,
            resolvedDecision: ARBITER_DECISIONS.remove,
            resolvedConfidence: state.removeScore >= 6 ? ARBITER_CONFIDENCE.high : ARBITER_CONFIDENCE.medium,
            reason: state.removeReasons[0] || state.reasons[0] || 'Deep-check confirmed remove',
            reasons: state.reasons,
            evidence: state.evidence,
            triggerReasons,
            warnings: analysis.mixins ? analysis.mixins.warnings : [],
            errors: [],
            analysis
        });
    }

    if (state.keepScore >= 3 && state.removeScore >= 3) {
        return createResult({
            status: DEEP_CHECK_STATUSES.forceManual,
            resolvedDecision: ARBITER_DECISIONS.review,
            resolvedConfidence: ARBITER_CONFIDENCE.low,
            reason: 'Deep-check found both keep and remove evidence',
            reasons: state.reasons,
            evidence: state.evidence,
            triggerReasons,
            warnings: analysis.mixins ? analysis.mixins.warnings : [],
            errors: [],
            analysis
        });
    }

    return createResult({
        status: DEEP_CHECK_STATUSES.stillReview,
        resolvedDecision: ARBITER_DECISIONS.review,
        resolvedConfidence: ARBITER_CONFIDENCE.low,
        reason: 'Deep-check did not produce enough decisive evidence',
        reasons: state.reasons.length > 0 ? state.reasons : ['Deep-check remained inconclusive'],
        evidence: state.evidence,
        triggerReasons,
        warnings: analysis.mixins ? analysis.mixins.warnings : [],
        errors: [],
        analysis
    });
}

function resolveBuildDecision(resolvedDecision: string | null, profile: string, currentBuildDecision: string): string {
    if (resolvedDecision === ARBITER_DECISIONS.remove) {
        return 'exclude';
    }

    if (resolvedDecision === ARBITER_DECISIONS.keep) {
        return 'keep';
    }

    if (profile === ARBITER_PROFILES.aggressive) {
        return currentBuildDecision === 'exclude' ? 'exclude' : 'keep';
    }

    return currentBuildDecision === 'exclude' ? 'exclude' : 'keep';
}

function performDeepCheck(input: DeepCheckInput, triggerReasons: string[] = []): DeepCheckResult {
    if (hasDependencyPreserve(input)) {
        return createResult({
            status: DEEP_CHECK_STATUSES.resolvedKeep,
            resolvedDecision: ARBITER_DECISIONS.keep,
            resolvedConfidence: ARBITER_CONFIDENCE.high,
            reason: input.dependencyReason || 'Dependency preservation overrode disputed signals',
            reasons: [input.dependencyReason || 'Dependency preservation overrode disputed signals'],
            evidence: [
                buildEvidence('dependency', input.dependencyReason || 'preserved-by-dependency', 'dependency-graph')
            ],
            triggerReasons,
            warnings: [],
            errors: [],
            analysis: {
                archiveContent: null,
                entrypoints: null,
                mixins: null
            }
        });
    }

    let archive: { readText(entryPath: string): string | null; entries: string[] };

    try {
        archive = createArchiveHandle(input.sourcePath);
    } catch (error: any) {
        return createResult({
            status: DEEP_CHECK_STATUSES.failed,
            resolvedDecision: ARBITER_DECISIONS.review,
            resolvedConfidence: ARBITER_CONFIDENCE.low,
            reason: 'Deep-check could not read the jar archive',
            reasons: ['Jar archive could not be opened for deep-check'],
            evidence: [],
            triggerReasons,
            warnings: [],
            errors: [
                {
                    code: error.code || 'DEEP_CHECK_ARCHIVE_ERROR',
                    message: error.message
                }
            ],
            analysis: {
                archiveContent: null,
                entrypoints: null,
                mixins: null
            }
        });
    }

    const archiveContent = analyzeArchiveContent(archive);
    const entrypoints = analyzeEntrypoints(input.descriptor);
    const mixins = analyzeMixins({
        archive,
        descriptor: input.descriptor
    });
    const analysis = {
        archiveContent,
        entrypoints,
        mixins
    };
    const state = {
        keepScore: 0,
        removeScore: 0,
        keepReasons: [] as string[],
        removeReasons: [] as string[],
        reasons: [] as string[],
        evidence: [] as EngineEvidence[]
    };

    applyDeclaredSide(state, input);
    applyEntrypoints(state, entrypoints);
    applyMixins(state, mixins);
    applyArchiveContent(state, archiveContent);

    return resolveScoredDecision(state, triggerReasons, analysis);
}

function applyDeepCheckResultToDecision(decision: Record<string, any>, result: DeepCheckResult, profile: string): Record<string, any> {
    const decisionChanged = (
        result.resolvedDecision === ARBITER_DECISIONS.keep || result.resolvedDecision === ARBITER_DECISIONS.remove
    ) && result.resolvedDecision !== decision.finalSemanticDecision;
    const nextBuildDecision = resolveBuildDecision(result.resolvedDecision, profile, decision.decision);

    if (result.status === DEEP_CHECK_STATUSES.resolvedKeep || result.status === DEEP_CHECK_STATUSES.resolvedRemove) {
        return {
            deepCheck: result,
            deepCheckStatus: result.status,
            deepCheckDecision: result.resolvedDecision,
            deepCheckConfidence: result.resolvedConfidence,
            deepCheckChangedDecision: decisionChanged,
            finalSemanticDecision: result.resolvedDecision,
            finalConfidence: result.resolvedConfidence,
            finalDecisionOrigin: 'deep-check',
            finalReasons: result.reasons,
            decision: nextBuildDecision,
            reason: result.reason,
            decisionOrigin: 'deep-check',
            requiresReview: false
        };
    }

    if (result.status === DEEP_CHECK_STATUSES.failed) {
        return {
            deepCheck: result,
            deepCheckStatus: result.status,
            deepCheckDecision: result.resolvedDecision,
            deepCheckConfidence: result.resolvedConfidence,
            deepCheckChangedDecision: decision.finalSemanticDecision !== ARBITER_DECISIONS.review,
            finalSemanticDecision: ARBITER_DECISIONS.review,
            finalConfidence: ARBITER_CONFIDENCE.low,
            finalDecisionOrigin: 'deep-check-failed',
            finalReasons: result.reasons,
            decision: 'keep',
            reason: result.reason,
            decisionOrigin: 'deep-check-failed',
            requiresReview: true
        };
    }

    return {
        deepCheck: result,
        deepCheckStatus: result.status,
        deepCheckDecision: result.resolvedDecision,
        deepCheckConfidence: result.resolvedConfidence,
        deepCheckChangedDecision: false,
        finalSemanticDecision: ARBITER_DECISIONS.review,
        finalConfidence: ARBITER_CONFIDENCE.low,
        finalDecisionOrigin: result.status === DEEP_CHECK_STATUSES.forceManual ? 'deep-check-force-manual' : 'deep-check-review',
        finalReasons: result.reasons,
        reason: result.reason,
        decisionOrigin: result.status === DEEP_CHECK_STATUSES.forceManual ? 'deep-check-force-manual' : 'deep-check-review',
        requiresReview: true
    };
}

module.exports = {
    applyDeepCheckResultToDecision,
    performDeepCheck
};
