const { ARBITER_CONFIDENCE, ARBITER_DECISIONS } = require('../arbiter/constants');

import type { DeepCheckMode, DeepCheckStatus, DeepCheckSummary } from '../types/deep-check';

const DEEP_CHECK_MODES = Object.freeze({
    auto: 'auto',
    off: 'off',
    force: 'force'
});

const DEEP_CHECK_STATUSES = Object.freeze({
    skipped: 'skipped',
    resolvedKeep: 'resolved-keep',
    resolvedRemove: 'resolved-remove',
    stillReview: 'still-review',
    forceManual: 'force-manual',
    failed: 'failed'
});

function normalizeDeepCheckMode(mode: unknown): DeepCheckMode | null {
    const value = String(mode || '').trim().toLowerCase();
    const allowedModes = Object.values(DEEP_CHECK_MODES) as string[];

    if (!value) {
        return DEEP_CHECK_MODES.auto;
    }

    return allowedModes.includes(value) ? value as DeepCheckMode : null;
}

function createEmptyDeepCheckSummary(mode: DeepCheckMode): DeepCheckSummary {
    return {
        mode,
        triggered: 0,
        skipped: 0,
        resolved: 0,
        unresolved: 0,
        failed: 0,
        decisionChanged: 0,
        statuses: {
            [DEEP_CHECK_STATUSES.skipped]: 0,
            [DEEP_CHECK_STATUSES.resolvedKeep]: 0,
            [DEEP_CHECK_STATUSES.resolvedRemove]: 0,
            [DEEP_CHECK_STATUSES.stillReview]: 0,
            [DEEP_CHECK_STATUSES.forceManual]: 0,
            [DEEP_CHECK_STATUSES.failed]: 0
        } as Record<DeepCheckStatus, number>,
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
        }
    };
}

module.exports = {
    DEEP_CHECK_MODES,
    DEEP_CHECK_STATUSES,
    createEmptyDeepCheckSummary,
    normalizeDeepCheckMode
};
