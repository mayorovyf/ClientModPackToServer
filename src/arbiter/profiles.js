const { ARBITER_BUILD_ACTIONS, ARBITER_PROFILES } = require('./constants');

function normalizeArbiterProfile(profile) {
    if (!profile) {
        return ARBITER_PROFILES.balanced;
    }

    const value = String(profile).trim().toLowerCase();

    return Object.values(ARBITER_PROFILES).includes(value) ? value : null;
}

function resolveReviewBuildAction(profile) {
    if (profile === ARBITER_PROFILES.aggressive) {
        return ARBITER_BUILD_ACTIONS.exclude;
    }

    return ARBITER_BUILD_ACTIONS.keep;
}

function resolveDefaultBuildAction(finalDecision, profile) {
    switch (finalDecision) {
        case 'remove':
            return ARBITER_BUILD_ACTIONS.exclude;
        case 'review':
            return resolveReviewBuildAction(profile);
        default:
            return ARBITER_BUILD_ACTIONS.keep;
    }
}

module.exports = {
    normalizeArbiterProfile,
    resolveDefaultBuildAction,
    resolveReviewBuildAction
};
