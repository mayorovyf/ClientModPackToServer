import type { RoleType } from '../types/classification';
import type { ValidationDecisionLike, ValidationJoinabilityResult } from '../types/validation';

const CLIENT_ONLY_ROLE_TYPES = new Set<RoleType>([
    'client-ui',
    'client-visual',
    'client-qol',
    'client-library',
    'compat-client'
]);
const SERVER_RELEVANT_ROLE_TYPES = new Set<RoleType>([
    'common-library',
    'common-gameplay',
    'common-optimization'
]);

function normalizeString(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null;
    }

    const normalized = String(value).trim();
    return normalized ? normalized : null;
}

function isExcludedDecision(decision: ValidationDecisionLike): boolean {
    return decision.actionStatus === 'excluded'
        || decision.actionStatus === 'would-exclude'
        || decision.buildDecision === 'exclude'
        || decision.finalSemanticDecision === 'remove';
}

function getDecisionRoleType(decision: ValidationDecisionLike): RoleType {
    const value = normalizeString((decision as ValidationDecisionLike & { finalRoleType?: unknown }).finalRoleType);
    return (value || 'unknown') as RoleType;
}

function getDecisionReasonText(decision: ValidationDecisionLike): string {
    const rawFinalReasons = (decision as ValidationDecisionLike & { finalReasons?: unknown[] }).finalReasons;
    const finalReasons = Array.isArray(rawFinalReasons) ? rawFinalReasons.map((entry) => normalizeString(entry)).filter((value): value is string => Boolean(value)) : [];

    return [
        normalizeString((decision as ValidationDecisionLike & { reason?: unknown }).reason),
        ...finalReasons
    ].filter(Boolean).join(' | ').toLowerCase();
}

function isConfirmedSafeExclusion(decision: ValidationDecisionLike): boolean {
    if (decision.topologyPartition === 'topology-incompatible-artifact') {
        return true;
    }

    const roleType = getDecisionRoleType(decision);

    if (CLIENT_ONLY_ROLE_TYPES.has(roleType)) {
        return true;
    }

    const reasonText = getDecisionReasonText(decision);
    return /client-only|client-side|environment type server|side mismatch|confirmed client-only suspect|ui helper|advancement ui/.test(reasonText);
}

function describeDecision(decision: ValidationDecisionLike): string {
    const modIds = (decision.descriptor?.modIds || []).map((modId) => normalizeString(modId)).filter((value): value is string => Boolean(value));
    return modIds.length > 0
        ? `${decision.fileName} [${modIds.join(', ')}]`
        : decision.fileName;
}

export function projectDeterministicJoinability({
    decisions
}: {
    decisions: ValidationDecisionLike[];
}): ValidationJoinabilityResult {
    const excludedDecisions = decisions.filter((decision) => isExcludedDecision(decision));
    const unsafeExcludedDecisions = excludedDecisions.filter((decision) => !isConfirmedSafeExclusion(decision));
    const suspiciousServerRelevant = excludedDecisions.filter((decision) => {
        const roleType = getDecisionRoleType(decision);
        return !isConfirmedSafeExclusion(decision) && SERVER_RELEVANT_ROLE_TYPES.has(roleType);
    });
    const ambiguousExclusions = unsafeExcludedDecisions.filter((decision) => {
        const roleType = getDecisionRoleType(decision);
        const reasonText = getDecisionReasonText(decision);
        return !CLIENT_ONLY_ROLE_TYPES.has(roleType)
            && !SERVER_RELEVANT_ROLE_TYPES.has(roleType)
            && !/client-only|client-side|environment type server|side mismatch|confirmed client-only suspect|ui helper|advancement ui/.test(reasonText);
    });

    if (suspiciousServerRelevant.length > 0) {
        return {
            status: 'failed',
            successMarkers: [],
            failureMarkers: [],
            evidence: [
                `Deterministic joinability projection failed because server-relevant artifacts were excluded: ${suspiciousServerRelevant.map((decision) => describeDecision(decision)).join('; ')}`
            ],
            checkedBy: ['deterministic-projection']
        };
    }

    if (ambiguousExclusions.length > 0) {
        return {
            status: 'not-checked',
            successMarkers: [],
            failureMarkers: [],
            evidence: [
                `Deterministic joinability projection is inconclusive because excluded artifacts remain ambiguous: ${ambiguousExclusions.map((decision) => describeDecision(decision)).join('; ')}`
            ],
            checkedBy: ['deterministic-projection']
        };
    }

    return {
        status: 'passed',
        successMarkers: [],
        failureMarkers: [],
        evidence: [
            excludedDecisions.length > 0
                ? 'Deterministic joinability projection passed: all excluded artifacts are explicitly client-only or topology-incompatible for the selected server runtime.'
                : 'Deterministic joinability projection passed: no original client artifacts were removed from the server candidate.'
        ],
        checkedBy: ['deterministic-projection']
    };
}

module.exports = {
    projectDeterministicJoinability
};
