const ARBITER_DECISIONS = Object.freeze({
    keep: 'keep',
    remove: 'remove',
    review: 'review'
});

const ARBITER_CONFIDENCE = Object.freeze({
    high: 'high',
    medium: 'medium',
    low: 'low',
    none: 'none'
});

const ARBITER_PROFILES = Object.freeze({
    safe: 'safe',
    balanced: 'balanced',
    aggressive: 'aggressive'
});

const ARBITER_BUILD_ACTIONS = Object.freeze({
    keep: 'keep',
    exclude: 'exclude'
});

const STRONG_ENGINE_CONFIDENCE = new Set([
    ARBITER_CONFIDENCE.high,
    ARBITER_CONFIDENCE.medium
]);

module.exports = {
    ARBITER_BUILD_ACTIONS,
    ARBITER_CONFIDENCE,
    ARBITER_DECISIONS,
    ARBITER_PROFILES,
    STRONG_ENGINE_CONFIDENCE
};
