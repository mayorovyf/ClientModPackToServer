import type { AppliedFix, CandidateState, SearchBudget } from './types';
import type { TrustPolicyAction, TrustPolicyContract } from '../types/policy';
import type { RunReport } from '../types/report';
import type { RunContext } from '../types/run';
import type { RuntimeTopologyId } from '../types/topology';
import type { ValidationIssue, ValidationSuspectedFalseRemoval } from '../types/validation';

interface CandidateMutations {
    forcedExcludes: string[];
    forcedKeeps: string[];
    acceptEula: boolean;
}

export interface CandidatePlan {
    runContext: RunContext;
    mutations: CandidateMutations;
    appliedFixes: AppliedFix[];
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
    return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))]
        .sort((left, right) => left.localeCompare(right));
}

function isActionAllowed(trustPolicy: TrustPolicyContract | null | undefined, action: TrustPolicyAction): boolean {
    return Boolean(trustPolicy?.actions.find((rule) => rule.action === action)?.allowed);
}

function hasAppliedFix(candidate: CandidateState, kind: string, marker: string | null = null): boolean {
    return candidate.appliedFixes.some((fix) => {
        if (fix.kind !== kind) {
            return false;
        }

        if (!marker) {
            return true;
        }

        return fix.fixId.includes(marker);
    });
}

function cloneRunContext(runContext: RunContext, patch: Partial<RunContext>): RunContext {
    return {
        ...runContext,
        ...patch
    };
}

function buildFix({
    fixId,
    kind,
    scope,
    summary,
    evidence
}: {
    fixId: string;
    kind: string;
    scope: AppliedFix['scope'];
    summary: string;
    evidence: string[];
}): AppliedFix {
    return {
        fixId,
        kind,
        scope,
        summary,
        evidence: evidence.slice(0, 5)
    };
}

function getEvidence(report: RunReport): string[] {
    if (report.failureAnalysis?.evidence?.length) {
        return report.failureAnalysis.evidence;
    }

    return (report.validation?.issues || []).map((issue) => issue.evidence).filter(Boolean);
}

function hasEulaEvidence(report: RunReport): boolean {
    const text = [
        ...getEvidence(report),
        ...(report.validation?.errors || []).map((error) => error.message),
        ...(report.validation?.failureMarkers || []).map((marker) => marker.evidence)
    ].join(' | ');

    return /eula|accept the eula|eula\.txt/i.test(text);
}

function isRemovalLinkedDecision(linkedDecision: NonNullable<ValidationIssue['linkedDecisions']>[number]): boolean {
    return linkedDecision.actionStatus === 'excluded'
        || linkedDecision.actionStatus === 'would-exclude'
        || linkedDecision.buildDecision === 'exclude'
        || linkedDecision.semanticDecision === 'remove';
}

function collectRecoverableDependencyFiles(report: RunReport): string[] {
    const recoverable = new Set<string>();

    for (const issue of report.validation?.issues || []) {
        if (issue.kind !== 'missing-dependency') {
            continue;
        }

        for (const linkedDecision of issue.linkedDecisions || []) {
            if (isRemovalLinkedDecision(linkedDecision)) {
                recoverable.add(linkedDecision.fileName);
            }
        }
    }

    for (const suspectedFalseRemoval of report.validation?.suspectedFalseRemovals || []) {
        if (suspectedFalseRemoval.issueKind === 'missing-dependency') {
            recoverable.add(suspectedFalseRemoval.fileName);
        }
    }

    return [...recoverable].sort((left, right) => left.localeCompare(right));
}

function collectRestorableFalseRemovalFiles(report: RunReport): string[] {
    return uniqueSorted(
        (report.validation?.suspectedFalseRemovals || [])
            .map((entry) => entry.fileName)
    );
}

function collectConnectorDependencyRecoveryFiles(report: RunReport): string[] {
    const recoverable = new Set<string>();

    for (const issue of report.validation?.issues || []) {
        if (issue.kind !== 'missing-dependency') {
            continue;
        }

        for (const linkedDecision of issue.linkedDecisions || []) {
            if (
                isRemovalLinkedDecision(linkedDecision)
                && (
                    linkedDecision.topologyPartition === 'connector-layer-artifact'
                    || /connector|sinytra|fabric-api|forgified/i.test(`${issue.evidence} ${issue.message}`)
                )
            ) {
                recoverable.add(linkedDecision.fileName);
            }
        }
    }

    return [...recoverable].sort((left, right) => left.localeCompare(right));
}

function isKeptDecision(report: RunReport, fileName: string): boolean {
    const decision = (report.decisions || []).find((entry) => entry.fileName === fileName);

    if (!decision || decision.manualOverrideAction) {
        return false;
    }

    return decision.decision === 'keep';
}

function collectRemovableClientOnlyFiles(report: RunReport): string[] {
    const removable = new Set<string>();

    for (const issue of report.validation?.issues || []) {
        if (issue.kind !== 'side-mismatch' && issue.kind !== 'mixin-failure' && issue.kind !== 'class-loading') {
            continue;
        }

        for (const linkedDecision of issue.linkedDecisions || []) {
            if (!isRemovalLinkedDecision(linkedDecision) && isKeptDecision(report, linkedDecision.fileName)) {
                removable.add(linkedDecision.fileName);
            }
        }
    }

    return [...removable].sort((left, right) => left.localeCompare(right));
}

function collectTopologyIncompatibleKeptFiles(report: RunReport): string[] {
    const removable = new Set<string>();

    for (const decision of report.decisions || []) {
        if (
            decision.topologyPartition === 'topology-incompatible-artifact'
            && (decision.decision === 'keep' || decision.actionStatus === 'copied' || decision.actionStatus === 'would-copy')
            && !decision.manualOverrideAction
        ) {
            removable.add(decision.fileName);
        }
    }

    for (const issue of report.validation?.issues || []) {
        for (const linkedDecision of issue.linkedDecisions || []) {
            if (
                linkedDecision.topologyPartition === 'topology-incompatible-artifact'
                && !isRemovalLinkedDecision(linkedDecision)
            ) {
                removable.add(linkedDecision.fileName);
            }
        }
    }

    return [...removable].sort((left, right) => left.localeCompare(right));
}

function getDecisionRoleType(report: RunReport, fileName: string): string | null {
    return (report.decisions || []).find((decision) => decision.fileName === fileName)?.finalRoleType || null;
}

function nextTimeoutMs(currentTimeoutMs: number): number {
    return Math.min(Math.max(currentTimeoutMs * 2, currentTimeoutMs + 5000), 120000);
}

function listCandidateTopologyIds(report: RunReport): RuntimeTopologyId[] {
    return uniqueSorted(report.releaseContract?.supportBoundary.runtimeTopology.candidateTopologyIds || []) as RuntimeTopologyId[];
}

function canApplyGuardedFix(searchBudget: SearchBudget, additionalGuardedFixes: number): boolean {
    return searchBudget.consumedGuardedFixes + additionalGuardedFixes <= searchBudget.maxGuardedFixes;
}

function canRetry(searchBudget: SearchBudget): boolean {
    return searchBudget.consumedRetries < searchBudget.maxRetries
        && searchBudget.consumedCandidateStates < searchBudget.maxCandidateStates;
}

function planRuntimeTopologySwitch({
    candidate,
    report,
    runContext,
    trustPolicy,
    searchBudget,
    mutations
}: {
    candidate: CandidateState;
    report: RunReport;
    runContext: RunContext;
    trustPolicy: TrustPolicyContract | null | undefined;
    searchBudget: SearchBudget;
    mutations: CandidateMutations;
}): CandidatePlan | null {
    if (!canRetry(searchBudget) || !canApplyGuardedFix(searchBudget, 1)) {
        return null;
    }

    if (!isActionAllowed(trustPolicy, 'switch-whitelisted-runtime-topology')) {
        return null;
    }

    const currentTopologyId = report.releaseContract?.supportBoundary.runtimeTopology.topologyId || null;
    const nextTopologyId = listCandidateTopologyIds(report).find((topologyId) => (
        topologyId !== currentTopologyId
        && !hasAppliedFix(candidate, 'switch-whitelisted-runtime-topology', topologyId)
    ));

    if (!nextTopologyId) {
        return null;
    }

    const fix = buildFix({
        fixId: `${candidate.candidateId}:switch-whitelisted-runtime-topology:${nextTopologyId}`,
        kind: 'switch-whitelisted-runtime-topology',
        scope: 'guarded',
        summary: `Retried convergence with supported runtime topology ${nextTopologyId}.`,
        evidence: getEvidence(report)
    });

    return {
        runContext: cloneRunContext(runContext, {
            preferredRuntimeTopologyId: nextTopologyId
        }),
        mutations,
        appliedFixes: [...candidate.appliedFixes, fix]
    };
}

function planAcceptEula({
    candidate,
    report,
    runContext,
    trustPolicy,
    mutations
}: {
    candidate: CandidateState;
    report: RunReport;
    runContext: RunContext;
    trustPolicy: TrustPolicyContract | null | undefined;
    mutations: CandidateMutations;
}): CandidatePlan | null {
    if (!hasEulaEvidence(report) || mutations.acceptEula || hasAppliedFix(candidate, 'accept-eula')) {
        return null;
    }

    if (!isActionAllowed(trustPolicy, 'accept-eula')) {
        return null;
    }

    const fix = buildFix({
        fixId: `${candidate.candidateId}:accept-eula`,
        kind: 'accept-eula',
        scope: 'safe-by-default',
        summary: 'Accepted EULA for the generated server workspace.',
        evidence: getEvidence(report)
    });

    return {
        runContext,
        mutations: {
            ...mutations,
            acceptEula: true
        },
        appliedFixes: [...candidate.appliedFixes, fix]
    };
}

function planEntrypointSwitch({
    candidate,
    report,
    runContext,
    trustPolicy,
    searchBudget,
    mutations
}: {
    candidate: CandidateState;
    report: RunReport;
    runContext: RunContext;
    trustPolicy: TrustPolicyContract | null | undefined;
    searchBudget: SearchBudget;
    mutations: CandidateMutations;
}): CandidatePlan | null {
    if (!runContext.validationEntrypointPath || hasAppliedFix(candidate, 'switch-whitelisted-entrypoint')) {
        return null;
    }

    if (!canRetry(searchBudget) || !canApplyGuardedFix(searchBudget, 1)) {
        return null;
    }

    if (!isActionAllowed(trustPolicy, 'switch-whitelisted-entrypoint')) {
        return null;
    }

    const fix = buildFix({
        fixId: `${candidate.candidateId}:switch-whitelisted-entrypoint`,
        kind: 'switch-whitelisted-entrypoint',
        scope: 'guarded',
        summary: 'Dropped the explicit validation entrypoint and retried with whitelist-safe auto-detection.',
        evidence: getEvidence(report)
    });

    return {
        runContext: cloneRunContext(runContext, {
            validationEntrypointPath: null
        }),
        mutations,
        appliedFixes: [...candidate.appliedFixes, fix]
    };
}

function planTrustedDependencyRecovery({
    candidate,
    report,
    runContext,
    trustPolicy,
    mutations
}: {
    candidate: CandidateState;
    report: RunReport;
    runContext: RunContext;
    trustPolicy: TrustPolicyContract | null | undefined;
    mutations: CandidateMutations;
}): CandidatePlan | null {
    if (!isActionAllowed(trustPolicy, 'add-trusted-dependency') || hasAppliedFix(candidate, 'add-trusted-dependency')) {
        return null;
    }

    const recoverableFiles = collectRecoverableDependencyFiles(report)
        .filter((fileName) => !mutations.forcedKeeps.includes(fileName));

    if (recoverableFiles.length !== 1) {
        return null;
    }

    const [fileName] = recoverableFiles;

    if (!fileName) {
        return null;
    }

    const fix = buildFix({
        fixId: `${candidate.candidateId}:add-trusted-dependency:${fileName}`,
        kind: 'add-trusted-dependency',
        scope: 'safe-by-default',
        summary: `Restored ${fileName} from the trusted source instance as a required dependency.`,
        evidence: getEvidence(report)
    });

    return {
        runContext,
        mutations: {
            ...mutations,
            forcedKeeps: uniqueSorted([...mutations.forcedKeeps, fileName]),
            forcedExcludes: mutations.forcedExcludes.filter((entry) => entry !== fileName)
        },
        appliedFixes: [...candidate.appliedFixes, fix]
    };
}

function planTrustedConnectorDependencyRecovery({
    candidate,
    report,
    runContext,
    trustPolicy,
    mutations
}: {
    candidate: CandidateState;
    report: RunReport;
    runContext: RunContext;
    trustPolicy: TrustPolicyContract | null | undefined;
    mutations: CandidateMutations;
}): CandidatePlan | null {
    if (!isActionAllowed(trustPolicy, 'add-trusted-connector-dependency') || hasAppliedFix(candidate, 'add-trusted-connector-dependency')) {
        return null;
    }

    const recoverableFiles = collectConnectorDependencyRecoveryFiles(report)
        .filter((fileName) => !mutations.forcedKeeps.includes(fileName));

    if (recoverableFiles.length !== 1) {
        return null;
    }

    const [fileName] = recoverableFiles;

    if (!fileName) {
        return null;
    }

    const fix = buildFix({
        fixId: `${candidate.candidateId}:add-trusted-connector-dependency:${fileName}`,
        kind: 'add-trusted-connector-dependency',
        scope: 'safe-by-default',
        summary: `Restored ${fileName} from the trusted source instance as a connector dependency.`,
        evidence: getEvidence(report)
    });

    return {
        runContext,
        mutations: {
            ...mutations,
            forcedKeeps: uniqueSorted([...mutations.forcedKeeps, fileName]),
            forcedExcludes: mutations.forcedExcludes.filter((entry) => entry !== fileName)
        },
        appliedFixes: [...candidate.appliedFixes, fix]
    };
}

function planTopologyIncompatibleArtifactRemoval({
    candidate,
    report,
    runContext,
    trustPolicy,
    mutations
}: {
    candidate: CandidateState;
    report: RunReport;
    runContext: RunContext;
    trustPolicy: TrustPolicyContract | null | undefined;
    mutations: CandidateMutations;
}): CandidatePlan | null {
    if (!isActionAllowed(trustPolicy, 'remove-confirmed-topology-incompatible-artifact')) {
        return null;
    }

    const removableFiles = collectTopologyIncompatibleKeptFiles(report)
        .filter((fileName) => !mutations.forcedExcludes.includes(fileName));

    if (removableFiles.length !== 1) {
        return null;
    }

    const [fileName] = removableFiles;

    if (!fileName || hasAppliedFix(candidate, 'remove-confirmed-topology-incompatible-artifact', fileName)) {
        return null;
    }

    const fix = buildFix({
        fixId: `${candidate.candidateId}:remove-confirmed-topology-incompatible-artifact:${fileName}`,
        kind: 'remove-confirmed-topology-incompatible-artifact',
        scope: 'safe-by-default',
        summary: `Removed ${fileName} after validation confirmed it is incompatible with the selected runtime topology.`,
        evidence: getEvidence(report)
    });

    return {
        runContext,
        mutations: {
            ...mutations,
            forcedExcludes: uniqueSorted([...mutations.forcedExcludes, fileName]),
            forcedKeeps: mutations.forcedKeeps.filter((entry) => entry !== fileName)
        },
        appliedFixes: [...candidate.appliedFixes, fix]
    };
}

function planServerRequiredArtifactRestore({
    candidate,
    report,
    runContext,
    trustPolicy,
    mutations
}: {
    candidate: CandidateState;
    report: RunReport;
    runContext: RunContext;
    trustPolicy: TrustPolicyContract | null | undefined;
    mutations: CandidateMutations;
}): CandidatePlan | null {
    if (!isActionAllowed(trustPolicy, 'restore-server-required-artifact') || hasAppliedFix(candidate, 'restore-server-required-artifact')) {
        return null;
    }

    const recoverableFiles = collectRestorableFalseRemovalFiles(report)
        .filter((fileName) => !mutations.forcedKeeps.includes(fileName));

    if (recoverableFiles.length !== 1) {
        return null;
    }

    const [fileName] = recoverableFiles;

    if (!fileName) {
        return null;
    }

    const fix = buildFix({
        fixId: `${candidate.candidateId}:restore-server-required-artifact:${fileName}`,
        kind: 'restore-server-required-artifact',
        scope: 'safe-by-default',
        summary: `Restored ${fileName} after validation suggested it was wrongly removed but server-required.`,
        evidence: getEvidence(report)
    });

    return {
        runContext,
        mutations: {
            ...mutations,
            forcedKeeps: uniqueSorted([...mutations.forcedKeeps, fileName]),
            forcedExcludes: mutations.forcedExcludes.filter((entry) => entry !== fileName)
        },
        appliedFixes: [...candidate.appliedFixes, fix]
    };
}

function planClientOnlyRemoval({
    candidate,
    report,
    runContext,
    trustPolicy,
    mutations
}: {
    candidate: CandidateState;
    report: RunReport;
    runContext: RunContext;
    trustPolicy: TrustPolicyContract | null | undefined;
    mutations: CandidateMutations;
}): CandidatePlan | null {
    const removableFiles = collectRemovableClientOnlyFiles(report)
        .filter((fileName) => !mutations.forcedExcludes.includes(fileName));

    if (removableFiles.length !== 1) {
        return null;
    }

    const [fileName] = removableFiles;

    if (!fileName) {
        return null;
    }

    const roleType = getDecisionRoleType(report, fileName);
    const action = roleType === 'client-library'
        ? 'remove-confirmed-client-only-support-library'
        : 'remove-explicit-client-only-mod';

    if (!isActionAllowed(trustPolicy, action) || hasAppliedFix(candidate, action, fileName)) {
        return null;
    }

    const fix = buildFix({
        fixId: `${candidate.candidateId}:${action}:${fileName}`,
        kind: action,
        scope: 'safe-by-default',
        summary: `Removed ${fileName} after validation linked the failure to a single client-only suspect.`,
        evidence: getEvidence(report)
    });

    return {
        runContext,
        mutations: {
            ...mutations,
            forcedExcludes: uniqueSorted([...mutations.forcedExcludes, fileName]),
            forcedKeeps: mutations.forcedKeeps.filter((entry) => entry !== fileName)
        },
        appliedFixes: [...candidate.appliedFixes, fix]
    };
}

function planTimeoutRetry({
    candidate,
    report,
    runContext,
    trustPolicy,
    searchBudget,
    mutations
}: {
    candidate: CandidateState;
    report: RunReport;
    runContext: RunContext;
    trustPolicy: TrustPolicyContract | null | undefined;
    searchBudget: SearchBudget;
    mutations: CandidateMutations;
}): CandidatePlan | null {
    if (!canRetry(searchBudget) || !canApplyGuardedFix(searchBudget, 1)) {
        return null;
    }

    if (!isActionAllowed(trustPolicy, 'retry-timeout')) {
        return null;
    }

    const timeoutMs = nextTimeoutMs(runContext.validationTimeoutMs);

    if (timeoutMs === runContext.validationTimeoutMs) {
        return null;
    }

    const fix = buildFix({
        fixId: `${candidate.candidateId}:retry-timeout:${timeoutMs}`,
        kind: 'retry-timeout',
        scope: 'guarded',
        summary: `Retried validation with a longer timeout (${timeoutMs}ms).`,
        evidence: getEvidence(report)
    });

    return {
        runContext: cloneRunContext(runContext, {
            validationTimeoutMs: timeoutMs
        }),
        mutations,
        appliedFixes: [...candidate.appliedFixes, fix]
    };
}

function planNextCandidate({
    candidate,
    report,
    runContext,
    searchBudget,
    mutations
}: {
    candidate: CandidateState;
    report: RunReport;
    runContext: RunContext;
    searchBudget: SearchBudget;
    mutations?: CandidateMutations;
}): CandidatePlan | null {
    const effectiveMutations: CandidateMutations = {
        forcedExcludes: uniqueSorted(mutations?.forcedExcludes || []),
        forcedKeeps: uniqueSorted(mutations?.forcedKeeps || []),
        acceptEula: Boolean(mutations?.acceptEula)
    };
    const trustPolicy = report.releaseContract?.trustPolicy;
    const acceptEulaPlan = planAcceptEula({
        candidate,
        report,
        runContext,
        trustPolicy,
        mutations: effectiveMutations
    });

    if (acceptEulaPlan) {
        return acceptEulaPlan;
    }

    switch (report.failureAnalysis?.family) {
        case 'wrong-runtime-topology':
        case 'connector-layer-incompatibility':
        case 'client-server-joinability-failure':
            return planRuntimeTopologySwitch({
                candidate,
                report,
                runContext,
                trustPolicy,
                searchBudget,
                mutations: effectiveMutations
            }) || planServerRequiredArtifactRestore({
                candidate,
                report,
                runContext,
                trustPolicy,
                mutations: effectiveMutations
            });
        case 'missing-trusted-connector-dependency':
            return planTrustedConnectorDependencyRecovery({
                candidate,
                report,
                runContext,
                trustPolicy,
                mutations: effectiveMutations
            }) || planServerRequiredArtifactRestore({
                candidate,
                report,
                runContext,
                trustPolicy,
                mutations: effectiveMutations
            });
        case 'topology-incompatible-artifact-kept':
            return planTopologyIncompatibleArtifactRemoval({
                candidate,
                report,
                runContext,
                trustPolicy,
                mutations: effectiveMutations
            });
        case 'wrong-java-or-launch-profile':
        case 'wrong-core-or-entrypoint':
            return planEntrypointSwitch({
                candidate,
                report,
                runContext,
                trustPolicy,
                searchBudget,
                mutations: effectiveMutations
            });
        case 'missing-trusted-dependency':
            return planTrustedDependencyRecovery({
                candidate,
                report,
                runContext,
                trustPolicy,
                mutations: effectiveMutations
            });
        case 'client-only-or-side-mismatch':
            return planClientOnlyRemoval({
                candidate,
                report,
                runContext,
                trustPolicy,
                mutations: effectiveMutations
            });
        case 'timeout-before-ready':
            return planTimeoutRetry({
                candidate,
                report,
                runContext,
                trustPolicy,
                searchBudget,
                mutations: effectiveMutations
            });
        default:
            return planServerRequiredArtifactRestore({
                candidate,
                report,
                runContext,
                trustPolicy,
                mutations: effectiveMutations
            });
    }
}

module.exports = {
    planNextCandidate
};
