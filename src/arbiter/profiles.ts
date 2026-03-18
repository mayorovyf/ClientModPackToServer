const { ARBITER_BUILD_ACTIONS, ARBITER_PROFILES } = require('./constants');

import type { ArbiterBuildAction, ArbiterProfile } from '../types/arbiter';

function normalizeArbiterProfile(profile: unknown): ArbiterProfile | null {
    if (!profile) {
        return ARBITER_PROFILES.balanced;
    }

    const value = String(profile).trim().toLowerCase();

    return Object.values(ARBITER_PROFILES).includes(value) ? value as ArbiterProfile : null;
}

function resolveReviewBuildAction(profile: ArbiterProfile): ArbiterBuildAction {
    if (profile === ARBITER_PROFILES.aggressive) {
        return ARBITER_BUILD_ACTIONS.exclude;
    }

    return ARBITER_BUILD_ACTIONS.keep;
}

function resolveDefaultBuildAction(finalDecision: string, profile: ArbiterProfile): ArbiterBuildAction {
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
