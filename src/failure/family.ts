const { evaluateTrustPolicyAction } = require('../policy/trust-policy');

import type { ConfidenceLevel } from '../types/classification';
import type { SupportBoundaryAssessment, TrustPolicyAction, TrustPolicyActionDecision, TrustPolicyContract } from '../types/policy';
import type { ValidationIssue, ValidationResult } from '../types/validation';

export type FailureFamily =
    | 'wrong-java-or-launch-profile'
    | 'missing-trusted-dependency'
    | 'client-only-or-side-mismatch'
    | 'wrong-core-or-entrypoint'
    | 'timeout-before-ready'
    | 'unknown-startup-failure';

export type FailureAnalysisKind = 'unsupported-by-boundary' | 'policy-blocked' | 'validation-family';

export interface FailureSuspectSet {
    modIds: string[];
    fileNames: string[];
    jarHints: string[];
}

export interface NormalizedFailureAnalysis {
    kind: FailureAnalysisKind;
    family: FailureFamily | null;
    confidence: ConfidenceLevel;
    explanation: string;
    evidence: string[];
    suspectSet: FailureSuspectSet;
    allowedActions: TrustPolicyAction[];
    blockedActions: TrustPolicyAction[];
    blockedActionReasons: string[];
}

const FAMILY_ACTIONS: Record<FailureFamily, TrustPolicyAction[]> = {
    'wrong-java-or-launch-profile': ['select-java-profile', 'switch-whitelisted-entrypoint'],
    'missing-trusted-dependency': ['add-trusted-dependency'],
    'client-only-or-side-mismatch': ['remove-explicit-client-only-mod', 'remove-confirmed-client-only-support-library'],
    'wrong-core-or-entrypoint': ['switch-whitelisted-server-core', 'switch-whitelisted-entrypoint'],
    'timeout-before-ready': ['retry-timeout'],
    'unknown-startup-failure': []
};

const FAMILY_EXPLANATIONS: Record<FailureFamily, string> = {
    'wrong-java-or-launch-profile': 'Validation evidence points to a Java/runtime launch profile mismatch.',
    'missing-trusted-dependency': 'Validation evidence points to a missing required dependency that should come from a trusted source.',
    'client-only-or-side-mismatch': 'Validation evidence points to a client-only mod or a client/server side mismatch.',
    'wrong-core-or-entrypoint': 'Validation evidence points to an incorrect server core or launch entrypoint.',
    'timeout-before-ready': 'Validation timed out before a reliable ready marker appeared.',
    'unknown-startup-failure': 'Validation detected a startup failure, but it does not fit a more specific release family yet.'
};

function uniqueSorted(values: Array<string | null | undefined>): string[] {
    return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))]
        .sort((left, right) => left.localeCompare(right));
}

function rankConfidence(confidence: ConfidenceLevel): number {
    switch (confidence) {
        case 'high':
            return 4;
        case 'medium':
            return 3;
        case 'low':
            return 2;
        default:
            return 1;
    }
}

function maxConfidence(values: ConfidenceLevel[]): ConfidenceLevel {
    return values.reduce<ConfidenceLevel>((best, current) => (
        rankConfidence(current) > rankConfidence(best) ? current : best
    ), 'none');
}

function collectValidationEvidence(validation: ValidationResult | null | undefined): string[] {
    if (!validation) {
        return [];
    }

    const evidence = [
        ...(validation.issues || []).map((issue) => issue.evidence),
        ...(validation.errors || []).map((error) => error.message),
        ...(validation.failureMarkers || []).map((marker) => marker.evidence),
        validation.skipReason || null
    ];

    return uniqueSorted(evidence).slice(0, 5);
}

function collectValidationText(validation: ValidationResult | null | undefined): string {
    return collectValidationEvidence(validation).join(' | ');
}

function collectSuspectSet(validation: ValidationResult | null | undefined): FailureSuspectSet {
    if (!validation) {
        return {
            modIds: [],
            fileNames: [],
            jarHints: []
        };
    }

    const modIds = uniqueSorted([
        ...validation.issues.flatMap((issue) => [...issue.modIds, ...issue.suspectedModIds]),
        ...validation.issues.flatMap((issue) => (issue.linkedDecisions || []).flatMap((decision) => decision.modIds || []))
    ]);
    const fileNames = uniqueSorted([
        ...validation.issues.flatMap((issue) => (issue.linkedDecisions || []).map((decision) => decision.fileName)),
        ...validation.suspectedFalseRemovals.map((entry) => entry.fileName)
    ]);
    const jarHints = uniqueSorted(validation.issues.flatMap((issue) => issue.jarHints));

    return {
        modIds,
        fileNames,
        jarHints
    };
}

function hasIssueKind(issues: ValidationIssue[], kind: ValidationIssue['kind']): boolean {
    return issues.some((issue) => issue.kind === kind);
}

function hasClientClassLoadingHints(text: string): boolean {
    return /net[/.]minecraft[/.]client|client[/.]gui|environment type server|client-only/i.test(text);
}

function isLikelyJavaRuntimeFailure(text: string): boolean {
    return /unsupportedclassversionerror|unsupported major\.minor|compiled by a more recent version of the java runtime|unsupported class file major version|could not create the java virtual machine|a jni error has occurred|invalid maximum heap size|could not reserve enough space|spawn .*enoent|not recognized as an internal or external command/i.test(text);
}

function isLikelyEntrypointFailure(text: string): boolean {
    return /validation entrypoint was not found|could not find or load main class|unable to access jarfile|entrypoint was not found/i.test(text);
}

function resolveValidationFailureFamily(validation: ValidationResult | null | undefined): FailureFamily | null {
    if (!validation || !validation.runAttempted || validation.status === 'not-run' || validation.status === 'skipped' || validation.status === 'passed') {
        return null;
    }

    const issues = validation.issues || [];
    const evidenceText = collectValidationText(validation);

    if (validation.status === 'timed-out') {
        return 'timeout-before-ready';
    }

    if (isLikelyEntrypointFailure(evidenceText)) {
        return 'wrong-core-or-entrypoint';
    }

    if (isLikelyJavaRuntimeFailure(evidenceText)) {
        return 'wrong-java-or-launch-profile';
    }

    if (hasIssueKind(issues, 'missing-dependency')) {
        return 'missing-trusted-dependency';
    }

    if (hasIssueKind(issues, 'side-mismatch') || hasIssueKind(issues, 'mixin-failure')) {
        return 'client-only-or-side-mismatch';
    }

    if (hasIssueKind(issues, 'entrypoint-crash')) {
        return 'wrong-core-or-entrypoint';
    }

    if (hasIssueKind(issues, 'class-loading') && hasClientClassLoadingHints(evidenceText)) {
        return 'client-only-or-side-mismatch';
    }

    if (validation.status === 'error' && !validation.entrypoint) {
        return 'wrong-core-or-entrypoint';
    }

    if (hasIssueKind(issues, 'class-loading')) {
        return 'unknown-startup-failure';
    }

    if (hasIssueKind(issues, 'unknown-critical') || hasIssueKind(issues, 'validation-no-success-marker')) {
        return 'unknown-startup-failure';
    }

    if (validation.status === 'failed' || validation.status === 'error') {
        return 'unknown-startup-failure';
    }

    return null;
}

function resolveFailureConfidence({
    validation,
    family
}: {
    validation: ValidationResult | null | undefined;
    family: FailureFamily;
}): ConfidenceLevel {
    if (!validation) {
        return family === 'unknown-startup-failure' ? 'low' : 'none';
    }

    if (family === 'timeout-before-ready') {
        return 'high';
    }

    const issueConfidence = maxConfidence((validation.issues || []).map((issue) => issue.confidence));

    if (issueConfidence !== 'none') {
        if (family === 'unknown-startup-failure' && issueConfidence === 'high') {
            return 'medium';
        }

        return issueConfidence;
    }

    if (validation.errors.length > 0) {
        return family === 'unknown-startup-failure' ? 'low' : 'medium';
    }

    return family === 'unknown-startup-failure' ? 'low' : 'medium';
}

function resolveRecommendedActions(family: FailureFamily, trustPolicy: TrustPolicyContract): TrustPolicyAction[] {
    const allowedByContract = new Set(trustPolicy.actions.map((action) => action.action));

    return FAMILY_ACTIONS[family].filter((action) => allowedByContract.has(action));
}

function evaluateRecommendedActions(actions: TrustPolicyAction[]): TrustPolicyActionDecision[] {
    return actions.map((action) => evaluateTrustPolicyAction(action));
}

function inferPreliminaryFailureFamily(validation: ValidationResult | null | undefined): FailureFamily | null {
    return resolveValidationFailureFamily(validation);
}

function normalizeFailureAnalysis({
    supportBoundary,
    trustPolicy,
    validation
}: {
    supportBoundary: SupportBoundaryAssessment;
    trustPolicy: TrustPolicyContract;
    validation: ValidationResult | null | undefined;
}): NormalizedFailureAnalysis | null {
    if (supportBoundary.status === 'unsupported') {
        return {
            kind: 'unsupported-by-boundary',
            family: null,
            confidence: 'high',
            explanation: supportBoundary.summary,
            evidence: uniqueSorted(supportBoundary.reasons).slice(0, 5),
            suspectSet: {
                modIds: [],
                fileNames: [],
                jarHints: []
            },
            allowedActions: [],
            blockedActions: [],
            blockedActionReasons: []
        };
    }

    const family = resolveValidationFailureFamily(validation);

    if (!family) {
        return null;
    }

    const recommendedActions = resolveRecommendedActions(family, trustPolicy);
    const actionDecisions = evaluateRecommendedActions(recommendedActions);
    const allowedActions = uniqueSorted(actionDecisions.filter((decision) => decision.allowed).map((decision) => decision.action)) as TrustPolicyAction[];
    const blockedActions = uniqueSorted(actionDecisions.filter((decision) => !decision.allowed).map((decision) => decision.action)) as TrustPolicyAction[];
    const blockedActionReasons = uniqueSorted(actionDecisions.map((decision) => decision.denialReason || null));
    const policyBlocked = actionDecisions.length > 0 && allowedActions.length === 0 && blockedActions.length > 0;

    return {
        kind: policyBlocked ? 'policy-blocked' : 'validation-family',
        family,
        confidence: resolveFailureConfidence({
            validation,
            family
        }),
        explanation: policyBlocked
            ? `Validation isolated ${family}, but every mapped next action is blocked by trust policy.`
            : FAMILY_EXPLANATIONS[family],
        evidence: collectValidationEvidence(validation),
        suspectSet: collectSuspectSet(validation),
        allowedActions,
        blockedActions,
        blockedActionReasons,
    };
}

module.exports = {
    inferPreliminaryFailureFamily,
    normalizeFailureAnalysis,
    resolveValidationFailureFamily
};
