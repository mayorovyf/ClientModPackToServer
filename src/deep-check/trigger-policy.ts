const { DEEP_CHECK_MODES } = require('./constants');
const { confidenceRank } = require('../classification/engine-result');

import type { DeepCheckInput, DeepCheckTrigger } from '../types/deep-check';
import type { EngineResult, FinalClassification } from '../types/classification';

function getEngineResult(classification: FinalClassification | null, engineName: string): EngineResult | null {
    const results = classification && Array.isArray(classification.results) ? classification.results : [];
    return results.find((result) => result.engine === engineName) || null;
}

function hasRegistryMetadataDisagreement(classification: FinalClassification | null): boolean {
    const metadata = getEngineResult(classification, 'metadata-engine');
    const registry = getEngineResult(classification, 'registry-engine');

    if (!metadata || !registry) {
        return false;
    }

    if (!['keep', 'remove'].includes(metadata.decision) || !['keep', 'remove'].includes(registry.decision)) {
        return false;
    }

    return metadata.decision !== registry.decision;
}

function hasDependencyCaution(input: DeepCheckInput): boolean {
    return (input.dependencyFindings || []).some((finding) => [
        'missing-required',
        'provider-ambiguous',
        'incompatibility'
    ].includes(finding.type));
}

function hasStrongKeepConsensus(classification: FinalClassification | null): boolean {
    const metadata = getEngineResult(classification, 'metadata-engine');
    const registry = getEngineResult(classification, 'registry-engine');

    if (!metadata || !registry) {
        return false;
    }

    if (metadata.decision !== 'keep' || registry.decision !== 'keep') {
        return false;
    }

    return confidenceRank(metadata.confidence) >= 2 && confidenceRank(registry.confidence) >= 2;
}

function hasStrongActionableConflict(classification: FinalClassification | null): boolean {
    const results = classification && Array.isArray(classification.results) ? classification.results : [];
    const strongKeepSignals = results.filter(
        (result) => result.decision === 'keep' && confidenceRank(result.confidence) >= 2
    );
    const strongRemoveSignals = results.filter(
        (result) => result.decision === 'remove' && confidenceRank(result.confidence) >= 2
    );

    return strongKeepSignals.length > 0 && strongRemoveSignals.length > 0;
}

function evaluateDeepCheckTrigger(input: DeepCheckInput): DeepCheckTrigger {
    const mode = input.deepCheckMode || DEEP_CHECK_MODES.auto;

    if (mode === DEEP_CHECK_MODES.off) {
        return {
            mode,
            shouldRun: false,
            mandatory: false,
            triggerReasons: ['deep-check mode is off']
        };
    }

    if (mode === DEEP_CHECK_MODES.force) {
        return {
            mode,
            shouldRun: true,
            mandatory: true,
            triggerReasons: ['deep-check mode forced execution']
        };
    }

    const triggerReasons: string[] = [];
    const dependencyCaution = hasDependencyCaution(input);
    const hasStrongConflict = hasStrongActionableConflict(input.classification);
    const registryMetadataDisagreement = hasRegistryMetadataDisagreement(input.classification);
    const strongKeepConsensus = hasStrongKeepConsensus(input.classification);

    if (strongKeepConsensus && !dependencyCaution && !hasStrongConflict && !registryMetadataDisagreement) {
        return {
            mode,
            shouldRun: false,
            mandatory: false,
            triggerReasons: ['metadata-engine and registry-engine already agree on a strong keep signal']
        };
    }

    if (input.requiresDeepCheck) {
        triggerReasons.push('arbiter explicitly requested deep-check');
    }

    if (input.requiresReview) {
        triggerReasons.push('arbiter escalated the mod to review');
    }

    if (hasStrongConflict) {
        triggerReasons.push('classification engines produced conflicting actionable signals');
    }

    if (input.arbiterDecision === 'review' && input.arbiterConfidence === 'low') {
        triggerReasons.push('review decision has low confidence');
    }

    if (registryMetadataDisagreement) {
        triggerReasons.push('metadata-engine and registry-engine disagree');
    }

    if (dependencyCaution) {
        triggerReasons.push('dependency validation requires extra caution');
    }

    return {
        mode,
        shouldRun: triggerReasons.length > 0,
        mandatory: input.requiresDeepCheck || dependencyCaution,
        triggerReasons
    };
}

module.exports = {
    evaluateDeepCheckTrigger
};
