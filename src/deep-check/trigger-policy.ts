const { DEEP_CHECK_MODES } = require('./constants');

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

    if (input.requiresDeepCheck) {
        triggerReasons.push('arbiter explicitly requested deep-check');
    }

    if (input.requiresReview) {
        triggerReasons.push('arbiter escalated the mod to review');
    }

    if (input.classification && input.classification.conflict && input.classification.conflict.hasConflict) {
        triggerReasons.push('classification engines produced conflicting actionable signals');
    }

    if (input.arbiterDecision === 'review' && input.arbiterConfidence === 'low') {
        triggerReasons.push('review decision has low confidence');
    }

    if (hasRegistryMetadataDisagreement(input.classification)) {
        triggerReasons.push('metadata-engine and registry-engine disagree');
    }

    if (hasDependencyCaution(input)) {
        triggerReasons.push('dependency validation requires extra caution');
    }

    return {
        mode,
        shouldRun: triggerReasons.length > 0,
        mandatory: input.requiresDeepCheck || hasDependencyCaution(input),
        triggerReasons
    };
}

module.exports = {
    evaluateDeepCheckTrigger
};
