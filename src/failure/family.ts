const { evaluateTrustPolicyAction } = require('../policy/trust-policy');

import type { ConfidenceLevel } from '../types/classification';
import type { SupportBoundaryAssessment, TrustPolicyAction, TrustPolicyActionDecision, TrustPolicyContract } from '../types/policy';
import type { ValidationIssue, ValidationResult } from '../types/validation';

export type FailureFamily =
    | 'wrong-java-or-launch-profile'
    | 'missing-trusted-dependency'
    | 'client-only-or-side-mismatch'
    | 'wrong-runtime-topology-or-core-or-entrypoint'
    | 'client-server-joinability-failure'
    | 'timeout-before-ready'
    | 'unknown-startup-or-join-failure';

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
    'missing-trusted-dependency': ['add-trusted-dependency', 'add-trusted-connector-dependency'],
    'client-only-or-side-mismatch': ['remove-explicit-client-only-mod', 'remove-confirmed-client-only-support-library'],
    'wrong-runtime-topology-or-core-or-entrypoint': [
        'switch-whitelisted-runtime-topology',
        'switch-whitelisted-server-core',
        'switch-whitelisted-entrypoint',
        'add-trusted-connector-dependency',
        'remove-confirmed-topology-incompatible-artifact'
    ],
    'client-server-joinability-failure': [
        'restore-server-required-artifact',
        'add-trusted-dependency',
        'add-trusted-connector-dependency',
        'switch-whitelisted-runtime-topology'
    ],
    'timeout-before-ready': ['retry-timeout'],
    'unknown-startup-or-join-failure': []
};

const FAMILY_EXPLANATIONS: Record<FailureFamily, string> = {
    'wrong-java-or-launch-profile': 'Validation evidence points to a Java/runtime launch profile mismatch.',
    'missing-trusted-dependency': 'Validation evidence points to a missing required dependency that should come from a trusted source.',
    'client-only-or-side-mismatch': 'Validation evidence points to a client-only mod or a client/server side mismatch.',
    'wrong-runtime-topology-or-core-or-entrypoint': 'Validation evidence points to an incorrect runtime topology, server core, connector layer or launch entrypoint.',
    'client-server-joinability-failure': 'Validation evidence points to a joinability mismatch between the built server and the original client pack.',
    'timeout-before-ready': 'Validation timed out before a reliable ready marker appeared.',
    'unknown-startup-or-join-failure': 'Validation detected a startup or joinability failure, but it does not fit a more specific release family yet.'
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

function listIssuesByKind(issues: ValidationIssue[], kind: ValidationIssue['kind']): ValidationIssue[] {
    return issues.filter((issue) => issue.kind === kind);
}

function hasClientClassLoadingHints(text: string): boolean {
    return /net[/.]minecraft[/.]client|client[/.]gui|environment type server|client-only/i.test(text);
}

function isLikelyJavaRuntimeFailure(text: string): boolean {
    return /unsupportedclassversionerror|unsupported major\.minor|compiled by a more recent version of the java runtime|unsupported class file major version|could not create the java virtual machine|a jni error has occurred|invalid maximum heap size|could not reserve enough space|spawn .*enoent|not recognized as an internal or external command|requested java profile .* is not available/i.test(text);
}

function isLikelyEntrypointFailure(text: string): boolean {
    return /validation entrypoint was not found|could not find or load main class|unable to access jarfile|entrypoint was not found/i.test(text);
}

function isLikelyLaunchCommandFailure(text: string): boolean {
    return /could not find or load main class|could not resolve main class|command shape|launcher/i.test(text);
}

function isLikelyEntrypointSelectionFailure(text: string): boolean {
    return /validation entrypoint was not found|unable to access jarfile|no main manifest attribute|entrypoint was not found/i.test(text);
}

function hasTrustedDependencyCandidateEvidence(validation: ValidationResult | null | undefined): boolean {
    if (!validation) {
        return false;
    }

    return listIssuesByKind(validation.issues || [], 'missing-dependency').some((issue) => (
        issue.suspectedModIds.length > 0
        || issue.jarHints.length > 0
    ));
}

function hasConnectorDependencyCandidateEvidence(validation: ValidationResult | null | undefined): boolean {
    if (!validation) {
        return false;
    }

    return listIssuesByKind(validation.issues || [], 'missing-dependency').some((issue) => {
        const evidence = `${issue.evidence} ${issue.message}`.toLowerCase();
        const hasConnectorHints = /connector|sinytra|fabric-api|forgified/i.test(evidence)
            || issue.suspectedModIds.some((modId) => /connector|sinytra|fabric-api|forgified/i.test(modId))
            || issue.jarHints.some((jarHint) => /connector|sinytra|fabric-api|forgified/i.test(jarHint));

        return hasConnectorHints;
    });
}

function hasEulaEvidence(validation: ValidationResult | null | undefined): boolean {
    return /eula|accept the eula|eula\.txt/i.test(collectValidationText(validation));
}

function hasRuntimeTopologyIssue(validation: ValidationResult | null | undefined): boolean {
    return hasIssueKind(validation?.issues || [], 'runtime-topology')
        || /wrong runtime topology|runtime topology mismatch|not compatible with selected runtime topology|requires runtime topology/i.test(collectValidationText(validation));
}

function hasConnectorLayerIssue(validation: ValidationResult | null | undefined): boolean {
    return hasIssueKind(validation?.issues || [], 'connector-layer')
        || /sinytra connector|connector bootstrap failed|failed to initialize connector|connector layer incompatible/i.test(collectValidationText(validation));
}

function hasTopologyIncompatibleArtifactIssue(validation: ValidationResult | null | undefined): boolean {
    return listIssuesByKind(validation?.issues || [], 'topology-incompatible-artifact').length > 0
        || listIssuesByKind(validation?.issues || [], 'joinability-failure').some((issue) => (
            (issue.linkedDecisions || []).some((decision) => decision.topologyPartition === 'topology-incompatible-artifact')
        ))
        || listIssuesByKind(validation?.issues || [], 'class-loading').some((issue) => (
            (issue.linkedDecisions || []).some((decision) => (
                decision.topologyPartition === 'topology-incompatible-artifact'
                && (decision.buildDecision === 'keep' || decision.actionStatus === 'copied')
            ))
        ));
}

function hasJoinabilityFailure(validation: ValidationResult | null | undefined): boolean {
    return validation?.joinability?.status === 'failed'
        || hasIssueKind(validation?.issues || [], 'joinability-failure');
}

function resolveValidationFailureFamily(validation: ValidationResult | null | undefined): FailureFamily | null {
    if (!validation || !validation.runAttempted || validation.status === 'not-run' || validation.status === 'skipped' || validation.status === 'passed') {
        return null;
    }

    const issues = validation.issues || [];
    const evidenceText = collectValidationText(validation);

    if (hasJoinabilityFailure(validation)) {
        return 'client-server-joinability-failure';
    }

    if (hasTopologyIncompatibleArtifactIssue(validation) || hasConnectorLayerIssue(validation) || hasRuntimeTopologyIssue(validation)) {
        return 'wrong-runtime-topology-or-core-or-entrypoint';
    }

    if (isLikelyEntrypointFailure(evidenceText)) {
        return 'wrong-runtime-topology-or-core-or-entrypoint';
    }

    if (isLikelyJavaRuntimeFailure(evidenceText)) {
        return 'wrong-java-or-launch-profile';
    }

    if (hasIssueKind(issues, 'java-runtime')) {
        return 'wrong-java-or-launch-profile';
    }

    if (hasIssueKind(issues, 'launch-profile')) {
        return isLikelyEntrypointSelectionFailure(evidenceText)
            ? 'wrong-runtime-topology-or-core-or-entrypoint'
            : 'wrong-java-or-launch-profile';
    }

    if (hasIssueKind(issues, 'missing-dependency')) {
        return 'missing-trusted-dependency';
    }

    if (hasIssueKind(issues, 'side-mismatch') || hasIssueKind(issues, 'mixin-failure')) {
        return 'client-only-or-side-mismatch';
    }

    if (hasIssueKind(issues, 'entrypoint-crash')) {
        return 'wrong-runtime-topology-or-core-or-entrypoint';
    }

    if (hasIssueKind(issues, 'class-loading') && hasClientClassLoadingHints(evidenceText)) {
        return 'client-only-or-side-mismatch';
    }

    if (validation.status === 'timed-out') {
        return 'timeout-before-ready';
    }

    if (validation.status === 'error' && !validation.entrypoint) {
        return 'wrong-runtime-topology-or-core-or-entrypoint';
    }

    if (hasIssueKind(issues, 'class-loading')) {
        return 'unknown-startup-or-join-failure';
    }

    if (hasIssueKind(issues, 'unknown-critical') || hasIssueKind(issues, 'validation-no-success-marker')) {
        return 'unknown-startup-or-join-failure';
    }

    if (validation.status === 'failed' || validation.status === 'error') {
        return 'unknown-startup-or-join-failure';
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
        return family === 'unknown-startup-or-join-failure' ? 'low' : 'none';
    }

    if (family === 'timeout-before-ready') {
        return 'medium';
    }

    if (family === 'client-server-joinability-failure') {
        return validation?.joinability?.status === 'failed' ? 'high' : 'medium';
    }

    if (family === 'wrong-java-or-launch-profile') {
        return 'high';
    }

    if (family === 'missing-trusted-dependency') {
        return hasTrustedDependencyCandidateEvidence(validation) ? 'high' : 'medium';
    }

    if (family === 'wrong-runtime-topology-or-core-or-entrypoint') {
        if (
            !validation?.entrypoint
            || hasIssueKind(validation.issues || [], 'entrypoint-crash')
            || hasIssueKind(validation.issues || [], 'launch-profile')
            || hasConnectorLayerIssue(validation)
            || hasRuntimeTopologyIssue(validation)
        ) {
            return 'high';
        }

        return 'medium';
    }

    if (family === 'client-only-or-side-mismatch') {
        if (hasIssueKind(validation.issues || [], 'side-mismatch')) {
            return 'high';
        }

        if (hasIssueKind(validation.issues || [], 'class-loading') && hasClientClassLoadingHints(collectValidationText(validation))) {
            return 'high';
        }

        return 'medium';
    }

    const issueConfidence = maxConfidence((validation.issues || []).map((issue) => issue.confidence));

    if (issueConfidence !== 'none') {
        if (family === 'unknown-startup-or-join-failure' && issueConfidence === 'high') {
            return 'medium';
        }

        return issueConfidence;
    }

    if (validation.errors.length > 0) {
        return family === 'unknown-startup-or-join-failure' ? 'low' : 'medium';
    }

    return family === 'unknown-startup-or-join-failure' ? 'low' : 'medium';
}

function resolveRecommendedActions(
    family: FailureFamily,
    trustPolicy: TrustPolicyContract,
    validation: ValidationResult | null | undefined
): TrustPolicyAction[] {
    const allowedByContract = new Set(trustPolicy.actions.map((action) => action.action));

    const actions = [...FAMILY_ACTIONS[family]];

    if (family === 'unknown-startup-or-join-failure' && hasEulaEvidence(validation)) {
        actions.push('accept-eula');
    }

    return [...new Set(actions)].filter((action) => allowedByContract.has(action));
}

function evaluateRecommendedActions({
    actions,
    family,
    validation
}: {
    actions: TrustPolicyAction[];
    family: FailureFamily;
    validation: ValidationResult | null | undefined;
}): TrustPolicyActionDecision[] {
    return actions.map((action) => {
        if (action === 'add-trusted-dependency') {
            return evaluateTrustPolicyAction(action, {
                trustedSource: hasTrustedDependencyCandidateEvidence(validation) ? null : false
            });
        }

        if (action === 'add-trusted-connector-dependency') {
            return evaluateTrustPolicyAction(action, {
                trustedSource: hasConnectorDependencyCandidateEvidence(validation) ? null : false
            });
        }

        if (action === 'restore-server-required-artifact') {
            return evaluateTrustPolicyAction(action, {
                trustedSource: hasTrustedDependencyCandidateEvidence(validation) || hasConnectorDependencyCandidateEvidence(validation) ? null : false
            });
        }

        return evaluateTrustPolicyAction(action);
    });
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

    const recommendedActions = resolveRecommendedActions(family, trustPolicy, validation);
    const actionDecisions = evaluateRecommendedActions({
        actions: recommendedActions,
        family,
        validation
    });
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
