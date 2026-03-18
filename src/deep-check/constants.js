const { ARBITER_CONFIDENCE, ARBITER_DECISIONS } = require('../arbiter/constants');

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

function normalizeDeepCheckMode(mode) {
    const value = String(mode || '').trim().toLowerCase();

    if (!value) {
        return DEEP_CHECK_MODES.auto;
    }

    return Object.values(DEEP_CHECK_MODES).includes(value) ? value : null;
}

function createEmptyDeepCheckSummary(mode) {
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
        },
        finalDecisions: {
            [ARBITER_DECISIONS.keep]: 0,
            [ARBITER_DECISIONS.remove]: 0,
            [ARBITER_DECISIONS.review]: 0
        },
        confidence: {
            [ARBITER_CONFIDENCE.high]: 0,
            [ARBITER_CONFIDENCE.medium]: 0,
            [ARBITER_CONFIDENCE.low]: 0,
            [ARBITER_CONFIDENCE.none]: 0
        }
    };
}

module.exports = {
    DEEP_CHECK_MODES,
    DEEP_CHECK_STATUSES,
    createEmptyDeepCheckSummary,
    normalizeDeepCheckMode
};
