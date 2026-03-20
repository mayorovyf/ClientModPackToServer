import type { AppliedFix, CandidateState, SearchBudget } from './types';
import type { TrustPolicyAction, TrustPolicyContract } from '../types/policy';
import type { RunReport } from '../types/report';
import type { RunContext } from '../types/run';
import type { JavaProfileId, RuntimeTopologyId } from '../types/topology';
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

function hasAppliedRemovalFix(candidate: CandidateState, fileName: string): boolean {
    return candidate.appliedFixes.some((fix) => (
        (
            fix.kind === 'remove-explicit-client-only-mod'
            || fix.kind === 'remove-confirmed-client-only-support-library'
            || fix.kind === 'remove-confirmed-topology-incompatible-artifact'
        )
        && fix.fixId.includes(fileName)
    ));
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

function isRemovalDecision(report: RunReport, fileName: string): boolean {
    const decision = (report.decisions || []).find((entry) => entry.fileName === fileName);

    if (!decision || decision.manualOverrideAction) {
        return false;
    }

    return decision.actionStatus === 'excluded'
        || decision.actionStatus === 'would-exclude'
        || decision.decision === 'exclude'
        || decision.finalSemanticDecision === 'remove';
}

function normalizeLookupToken(value: string | null | undefined): string {
    return String(value || '')
        .toLowerCase()
        .replace(/\.jar$/i, '')
        .replace(/[^a-z0-9]+/g, '');
}

function matchesMissingDependencyFileName(fileName: string, modId: string): boolean {
    const normalizedFileName = String(fileName || '').trim().toLowerCase().replace(/\.jar$/i, '');
    const normalizedModId = String(modId || '').trim().toLowerCase();

    if (!normalizedFileName || !normalizedModId) {
        return false;
    }

    if (
        normalizedFileName === normalizedModId
        || normalizedFileName.startsWith(`${normalizedModId}-`)
        || normalizedFileName.startsWith(`${normalizedModId}_`)
        || normalizedFileName.startsWith(`${normalizedModId}+`)
        || normalizedFileName.startsWith(`${normalizedModId}.`)
        || normalizedFileName.startsWith(`${normalizedModId} `)
    ) {
        return true;
    }

    const compactFileName = normalizeLookupToken(normalizedFileName);
    const compactModId = normalizeLookupToken(normalizedModId);
    return Boolean(compactModId) && compactFileName === compactModId;
}

function collectRecoverableDependencyFilesByModId(report: RunReport): string[] {
    const recoverable = new Set<string>();

    for (const issue of report.validation?.issues || []) {
        if (issue.kind !== 'missing-dependency') {
            continue;
        }

        const issueModIds = uniqueSorted([
            ...issue.modIds,
            ...issue.suspectedModIds
        ]);

        for (const modId of issueModIds) {
            const matches = (report.decisions || []).filter((decision) => {
                const modIdMatch = Array.isArray(decision.descriptor?.modIds)
                    && decision.descriptor.modIds.includes(modId);
                const fileNameMatch = matchesMissingDependencyFileName(decision.fileName, modId);

                return (modIdMatch || fileNameMatch) && isRemovalDecision(report, decision.fileName);
            });

            const matchedDecision = matches[0];

            if (matches.length === 1 && matchedDecision) {
                recoverable.add(matchedDecision.fileName);
            }
        }
    }

    return [...recoverable].sort((left, right) => left.localeCompare(right));
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

    for (const fileName of collectRecoverableDependencyFilesByModId(report)) {
        recoverable.add(fileName);
    }

    return [...recoverable].sort((left, right) => left.localeCompare(right));
}

function collectClientOnlyDependentsForMissingDependencies(candidate: CandidateState, report: RunReport): string[] {
    const missingDependencyModIds = uniqueSorted(
        (report.validation?.issues || [])
            .filter((issue) => issue.kind === 'missing-dependency')
            .flatMap((issue) => {
                const linkedRemovedFiles = (issue.linkedDecisions || [])
                    .filter((linkedDecision) => isRemovalLinkedDecision(linkedDecision) && hasAppliedRemovalFix(candidate, linkedDecision.fileName))
                    .map((linkedDecision) => linkedDecision.fileName);

                if (linkedRemovedFiles.length === 0) {
                    return [];
                }

                return [...issue.modIds, ...issue.suspectedModIds];
            })
    );

    if (missingDependencyModIds.length === 0) {
        return [];
    }

    const candidates = new Map<string, {
        fileName: string;
        score: number;
        roleType: string | null;
    }>();

    for (const decision of report.decisions || []) {
        if (decision.manualOverrideAction || !isKeptDecision(report, decision.fileName)) {
            continue;
        }

        const roleType = getDecisionRoleType(report, decision.fileName);

        if (!isExplicitClientOnlyRole(roleType)) {
            continue;
        }

        const requiredDependencies = Array.isArray(decision.dependencyDependencies?.required)
            ? decision.dependencyDependencies.required as Array<{ modId?: string | null }>
            : [];
        const matchedDependencies = requiredDependencies.filter((dependency) => (
            missingDependencyModIds.includes(String(dependency?.modId || ''))
        ));

        if (matchedDependencies.length === 0) {
            continue;
        }

        const score = (
            roleTypeRemovalPriority(roleType)
            + roleConfidenceScore(getDecisionRoleConfidence(report, decision.fileName))
            + matchedDependencies.length * 20
        );

        candidates.set(decision.fileName, {
            fileName: decision.fileName,
            score,
            roleType
        });
    }

    return [...candidates.values()]
        .sort((left, right) => (
            right.score - left.score
            || roleTypeRemovalPriority(right.roleType) - roleTypeRemovalPriority(left.roleType)
            || left.fileName.localeCompare(right.fileName)
        ))
        .map((candidate) => candidate.fileName);
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

function getDecision(report: RunReport, fileName: string) {
    return (report.decisions || []).find((entry) => entry.fileName === fileName) || null;
}

function getDecisionRoleConfidence(report: RunReport, fileName: string): string | null {
    return getDecision(report, fileName)?.roleConfidence || null;
}

function roleTypeRemovalPriority(roleType: string | null): number {
    switch (roleType) {
        case 'client-ui':
            return 50;
        case 'client-qol':
            return 45;
        case 'client-visual':
            return 45;
        case 'client-library':
            return 40;
        case 'compat-client':
            return 25;
        default:
            return 0;
    }
}

function roleConfidenceScore(confidence: string | null): number {
    switch (confidence) {
        case 'high':
            return 12;
        case 'medium':
            return 6;
        case 'low':
            return 2;
        default:
            return 0;
    }
}

function isExplicitClientOnlyRole(roleType: string | null): boolean {
    return roleType === 'client-ui'
        || roleType === 'client-qol'
        || roleType === 'client-visual'
        || roleType === 'client-library'
        || roleType === 'compat-client';
}

function isSafeClientOnlyRemovalCandidate({
    issue,
    linkedDecision,
    roleType
}: {
    issue: ValidationIssue;
    linkedDecision: NonNullable<ValidationIssue['linkedDecisions']>[number];
    roleType: string | null;
}): boolean {
    if (isExplicitClientOnlyRole(roleType)) {
        return true;
    }

    return issue.kind === 'side-mismatch' && linkedDecision.matchedBy === 'modId';
}

function scoreClientOnlyIssue(issue: ValidationIssue, fileName: string, report: RunReport): number {
    const roleType = getDecisionRoleType(report, fileName);
    const roleConfidence = getDecisionRoleConfidence(report, fileName);
    const normalizedEvidence = `${issue.evidence} ${issue.message}`.toLowerCase();
    let score = 0;

    switch (issue.kind) {
        case 'side-mismatch':
            score += 60;
            break;
        case 'mixin-failure':
            score += 35;
            break;
        case 'class-loading':
            score += 25;
            break;
        default:
            score += 10;
            break;
    }

    if (/attempted to load class .* invalid dist dedicated_server|environment type server|client-only/i.test(normalizedEvidence)) {
        score += 30;
    }

    if (/net[/.]minecraft[/.]client|com[/.]mojang[/.]blaze3d|mezz[/.]jei|keyboardinput|mousehandler|iteminhandrenderer|humanoidarmorlayer|craftingscreen|inventoryeffectrendererguihandler|camera|posestack|screen|renderer|gui/.test(normalizedEvidence)) {
        score += 18;
    }

    if ((issue.linkedDecisions || []).some((linkedDecision) => linkedDecision.fileName === fileName && linkedDecision.matchedBy === 'modId')) {
        score += 8;
    }

    score += roleTypeRemovalPriority(roleType);
    score += roleConfidenceScore(roleConfidence);

    return score;
}

function collectRemovableClientOnlyFiles(report: RunReport): string[] {
    const candidates = new Map<string, {
        fileName: string;
        score: number;
        issueCount: number;
        roleType: string | null;
    }>();

    for (const issue of report.validation?.issues || []) {
        if (issue.kind !== 'side-mismatch' && issue.kind !== 'mixin-failure' && issue.kind !== 'class-loading') {
            continue;
        }

        for (const linkedDecision of issue.linkedDecisions || []) {
            if (isRemovalLinkedDecision(linkedDecision) || !isKeptDecision(report, linkedDecision.fileName)) {
                continue;
            }

            const roleType = getDecisionRoleType(report, linkedDecision.fileName);

            if (!isSafeClientOnlyRemovalCandidate({
                issue,
                linkedDecision,
                roleType
            })) {
                continue;
            }

            const current = candidates.get(linkedDecision.fileName) || {
                fileName: linkedDecision.fileName,
                score: 0,
                issueCount: 0,
                roleType
            };

            current.score += scoreClientOnlyIssue(issue, linkedDecision.fileName, report);
            current.issueCount += 1;
            current.roleType = roleType;
            candidates.set(linkedDecision.fileName, current);
        }
    }

    return [...candidates.values()]
        .sort((left, right) => (
            right.score - left.score
            || right.issueCount - left.issueCount
            || roleTypeRemovalPriority(right.roleType) - roleTypeRemovalPriority(left.roleType)
            || left.fileName.localeCompare(right.fileName)
        ))
        .map((candidate) => candidate.fileName);
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

function listAllowedJavaProfiles(report: RunReport): JavaProfileId[] {
    return uniqueSorted(report.releaseContract?.supportBoundary.runtimeTopology.matchedWhitelistEntry?.allowedJavaProfiles || []) as JavaProfileId[];
}

function scoreJavaProfilePreference(report: RunReport, profile: JavaProfileId): number {
    const evidence = getEvidence(report).join(' | ').toLowerCase();

    if (profile === 'java-21') {
        if (/major version 65|java 21|requires java 21|class file version 65/i.test(evidence)) {
            return 100;
        }
    }

    if (profile === 'java-17') {
        if (/major version 61|java 17|requires java 17|class file version 61/i.test(evidence)) {
            return 100;
        }
    }

    return profile === 'auto' ? 10 : 50;
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

function planJavaProfileSwitch({
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
    if (!isActionAllowed(trustPolicy, 'select-java-profile')) {
        return null;
    }

    const currentProfile = runContext.javaProfile;
    const nextProfile = listAllowedJavaProfiles(report)
        .filter((profile) => profile !== currentProfile && !hasAppliedFix(candidate, 'select-java-profile', profile))
        .sort((left, right) => scoreJavaProfilePreference(report, right) - scoreJavaProfilePreference(report, left))[0];

    if (!nextProfile) {
        return null;
    }

    const fix = buildFix({
        fixId: `${candidate.candidateId}:select-java-profile:${nextProfile}`,
        kind: 'select-java-profile',
        scope: 'safe-by-default',
        summary: `Retried validation with Java profile ${nextProfile}.`,
        evidence: getEvidence(report)
    });

    return {
        runContext: cloneRunContext(runContext, {
            javaProfile: nextProfile
        }),
        mutations,
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

function planClientOnlyDependentRemoval({
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
    const removableFiles = collectClientOnlyDependentsForMissingDependencies(candidate, report)
        .filter((fileName) => !mutations.forcedExcludes.includes(fileName));

    if (removableFiles.length === 0) {
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
        summary: `Removed ${fileName} because it depends on a client-only artifact that validation proved should stay excluded.`,
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

    if (removableFiles.length === 0) {
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
    let plannedCandidate: CandidatePlan | null = null;

    switch (report.failureAnalysis?.family) {
        case 'client-server-joinability-failure':
            plannedCandidate = planRuntimeTopologySwitch({
                candidate,
                report,
                runContext,
                trustPolicy,
                searchBudget,
                mutations: effectiveMutations
            }) || planTrustedDependencyRecovery({
                candidate,
                report,
                runContext,
                trustPolicy,
                mutations: effectiveMutations
            }) || planTrustedConnectorDependencyRecovery({
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
            break;
        case 'wrong-runtime-topology-or-core-or-entrypoint':
            plannedCandidate = planRuntimeTopologySwitch({
                candidate,
                report,
                runContext,
                trustPolicy,
                searchBudget,
                mutations: effectiveMutations
            }) || planTrustedConnectorDependencyRecovery({
                candidate,
                report,
                runContext,
                trustPolicy,
                mutations: effectiveMutations
            }) || planTopologyIncompatibleArtifactRemoval({
                candidate,
                report,
                runContext,
                trustPolicy,
                mutations: effectiveMutations
            }) || planEntrypointSwitch({
                candidate,
                report,
                runContext,
                trustPolicy,
                searchBudget,
                mutations: effectiveMutations
            });
            break;
        case 'wrong-java-or-launch-profile':
            plannedCandidate = planJavaProfileSwitch({
                candidate,
                report,
                runContext,
                trustPolicy,
                mutations: effectiveMutations
            }) || planEntrypointSwitch({
                candidate,
                report,
                runContext,
                trustPolicy,
                searchBudget,
                mutations: effectiveMutations
            });
            break;
        case 'missing-trusted-dependency':
            plannedCandidate = planClientOnlyDependentRemoval({
                candidate,
                report,
                runContext,
                trustPolicy,
                mutations: effectiveMutations
            }) || planTrustedDependencyRecovery({
                candidate,
                report,
                runContext,
                trustPolicy,
                mutations: effectiveMutations
            }) || planTrustedConnectorDependencyRecovery({
                candidate,
                report,
                runContext,
                trustPolicy,
                mutations: effectiveMutations
            });
            break;
        case 'client-only-or-side-mismatch':
            plannedCandidate = planClientOnlyRemoval({
                candidate,
                report,
                runContext,
                trustPolicy,
                mutations: effectiveMutations
            });
            break;
        case 'timeout-before-ready':
            plannedCandidate = planTimeoutRetry({
                candidate,
                report,
                runContext,
                trustPolicy,
                searchBudget,
                mutations: effectiveMutations
            });
            break;
        default:
            plannedCandidate = null;
            break;
    }

    return plannedCandidate || planAcceptEula({
        candidate,
        report,
        runContext,
        trustPolicy,
        mutations: effectiveMutations
    });
}

module.exports = {
    planNextCandidate
};
