const {
    SUPPORTED_SERVER_CORE_TYPES,
    SUPPORTED_VALIDATION_ENTRYPOINT_KINDS
} = require('./constants');

import type { TrustPolicyAction, TrustPolicyActionDecision, TrustPolicyActionRule, TrustPolicyContract } from '../types/policy';
import type { ServerCoreType } from '../server/types';
import type { ValidationEntrypointKind } from '../types/validation';

const TRUST_POLICY_RULES: Record<TrustPolicyAction, Omit<TrustPolicyActionRule, 'action'>> = {
    'accept-eula': {
        disposition: 'safe-by-default',
        allowed: true,
        summary: 'EULA acceptance is allowed as a safe-by-default action inside Tier A automation.',
        requiresTrustedSource: false
    },
    'select-java-profile': {
        disposition: 'safe-by-default',
        allowed: true,
        summary: 'Java profile selection is allowed when evidence points to a supported runtime requirement.',
        requiresTrustedSource: false
    },
    'add-trusted-dependency': {
        disposition: 'safe-by-default',
        allowed: true,
        summary: 'Dependency addition is allowed only when the provider comes from a trusted source.',
        requiresTrustedSource: true
    },
    'remove-explicit-client-only-mod': {
        disposition: 'safe-by-default',
        allowed: true,
        summary: 'Explicitly client-only mods may be removed automatically when evidence is strong enough.',
        requiresTrustedSource: false
    },
    'remove-confirmed-client-only-support-library': {
        disposition: 'safe-by-default',
        allowed: true,
        summary: 'Confirmed client-only support libraries may be removed automatically when they are validated as server-unsafe.',
        requiresTrustedSource: false
    },
    'switch-whitelisted-server-core': {
        disposition: 'guarded',
        allowed: true,
        summary: 'Server core switching is guarded and only allowed inside the whitelisted core set.',
        requiresTrustedSource: false,
        supportedCoreTypes: [...SUPPORTED_SERVER_CORE_TYPES]
    },
    'switch-whitelisted-entrypoint': {
        disposition: 'guarded',
        allowed: true,
        summary: 'Entrypoint switching is guarded and only allowed for whitelist-supported validation entrypoint kinds.',
        requiresTrustedSource: false,
        supportedEntrypointKinds: [...SUPPORTED_VALIDATION_ENTRYPOINT_KINDS]
    },
    'retry-timeout': {
        disposition: 'guarded',
        allowed: true,
        summary: 'Timeout retries are guarded and must remain bounded by the search budget.',
        requiresTrustedSource: false
    },
    'mass-remove-suspects': {
        disposition: 'manual-only',
        allowed: false,
        summary: 'Mass removal of suspects is outside the automatic Tier A path and stays manual-only.',
        requiresTrustedSource: false
    },
    'patch-third-party-jar': {
        disposition: 'forbidden',
        allowed: false,
        summary: 'Patching third-party jars is outside the trust policy.',
        requiresTrustedSource: false
    },
    'mutate-source-instance': {
        disposition: 'forbidden',
        allowed: false,
        summary: 'Mutating the source instance is forbidden by the product boundary.',
        requiresTrustedSource: false
    },
    'download-untrusted-artifact': {
        disposition: 'forbidden',
        allowed: false,
        summary: 'Downloading or adding untrusted artifacts is forbidden.',
        requiresTrustedSource: false
    },
    'run-untrusted-installer': {
        disposition: 'forbidden',
        allowed: false,
        summary: 'Running opaque or untrusted installers is forbidden.',
        requiresTrustedSource: false
    },
    'connector-specific-risky-fix': {
        disposition: 'forbidden',
        allowed: false,
        summary: 'Connector-specific risky fixes are outside the Tier A trust policy.',
        requiresTrustedSource: false
    }
};

function toRule(action: TrustPolicyAction): TrustPolicyActionRule {
    const rule = TRUST_POLICY_RULES[action];

    return {
        action,
        disposition: rule.disposition,
        allowed: rule.allowed,
        summary: rule.summary,
        requiresTrustedSource: rule.requiresTrustedSource,
        ...(rule.supportedCoreTypes ? { supportedCoreTypes: [...rule.supportedCoreTypes] } : {}),
        ...(rule.supportedEntrypointKinds ? { supportedEntrypointKinds: [...rule.supportedEntrypointKinds] } : {})
    };
}

function groupActionsByDisposition(disposition: TrustPolicyActionRule['disposition']): TrustPolicyAction[] {
    return Object.keys(TRUST_POLICY_RULES)
        .filter((action) => TRUST_POLICY_RULES[action as TrustPolicyAction].disposition === disposition) as TrustPolicyAction[];
}

function createTrustPolicyContract(): TrustPolicyContract {
    const actions = (Object.keys(TRUST_POLICY_RULES) as TrustPolicyAction[]).map((action) => toRule(action));

    return {
        version: 'v1-tier-a',
        defaultDisposition: 'forbidden',
        summary: 'Tier A trust policy allows only safe-by-default and guarded actions inside a strict whitelist.',
        safeByDefaultActions: groupActionsByDisposition('safe-by-default'),
        guardedActions: groupActionsByDisposition('guarded'),
        manualOnlyActions: groupActionsByDisposition('manual-only'),
        forbiddenActions: groupActionsByDisposition('forbidden'),
        actions
    };
}

function evaluateTrustPolicyAction(
    action: TrustPolicyAction,
    {
        trustedSource = null,
        targetCoreType = null,
        entrypointKind = null
    }: {
        trustedSource?: boolean | null;
        targetCoreType?: ServerCoreType | null;
        entrypointKind?: ValidationEntrypointKind | null;
    } = {}
): TrustPolicyActionDecision {
    const contractRule = createTrustPolicyContract().actions.find((rule) => rule.action === action);

    if (!contractRule) {
        return {
            action,
            disposition: 'forbidden',
            allowed: false,
            summary: 'Unknown action is outside the trust policy.',
            requiresTrustedSource: false,
            denialReason: 'Unknown action is not part of the Tier A trust policy.',
            targetCoreType,
            entrypointKind,
            trustedSource
        };
    }

    let allowed = contractRule.allowed;
    let denialReason: string | null = null;

    if (allowed && contractRule.requiresTrustedSource && trustedSource === false) {
        allowed = false;
        denialReason = 'Action requires a trusted source.';
    }

    if (allowed && Array.isArray(contractRule.supportedCoreTypes) && targetCoreType && !contractRule.supportedCoreTypes.includes(targetCoreType)) {
        allowed = false;
        denialReason = `Core type ${targetCoreType} is outside the whitelist.`;
    }

    if (allowed && Array.isArray(contractRule.supportedEntrypointKinds) && entrypointKind && !contractRule.supportedEntrypointKinds.includes(entrypointKind)) {
        allowed = false;
        denialReason = `Entrypoint kind ${entrypointKind} is outside the whitelist.`;
    }

    if (!allowed && !denialReason) {
        denialReason = contractRule.disposition === 'manual-only'
            ? 'Action is manual-only in Tier A.'
            : contractRule.disposition === 'forbidden'
                ? 'Action is forbidden by trust policy.'
                : null;
    }

    return {
        ...contractRule,
        allowed,
        denialReason,
        targetCoreType,
        entrypointKind,
        trustedSource
    };
}

module.exports = {
    createTrustPolicyContract,
    evaluateTrustPolicyAction
};
