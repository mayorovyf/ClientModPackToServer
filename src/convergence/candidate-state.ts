const crypto = require('node:crypto');

const { createCandidateFingerprint } = require('./candidate-fingerprint');
const { createDefaultSearchBudget } = require('./search-budget');
const { inferPreliminaryFailureFamily, normalizeFailureAnalysis } = require('../failure/family');

import type { CandidateState, CandidateTrace } from './types';
import type { ResolvedTerminalOutcome } from '../types/outcome';
import type { RunReport } from '../types/report';
import type { RunContext } from '../types/run';
import type { LoaderKind } from '../types/metadata';

function detectSingleLoader(report: RunReport): LoaderKind | null {
    if (report.runtimeDetection?.loader) {
        return report.runtimeDetection.loader;
    }

    const loaders = new Set(
        (report.decisions || [])
            .map((decision) => decision?.descriptor?.loader)
            .filter((loader): loader is LoaderKind => typeof loader === 'string' && loader !== 'unknown')
    );

    return loaders.size === 1 ? [...loaders][0] || null : null;
}

function createValidationSnapshot(report: RunReport): CandidateState['validation'] {
    const validation = report.validation;

    if (!validation) {
        return null;
    }

    return {
        status: validation.runAttempted ? validation.status : 'not-run',
        entrypointKind: validation.entrypoint?.kind || null,
        entrypointPath: validation.entrypoint?.originalPath || null,
        successMarkers: validation.successMarkers.length,
        failureMarkers: validation.failureMarkers.length,
        totalIssues: validation.issues.length,
        issueKinds: [...new Set(validation.issues.map((issue) => issue.kind))].sort((left, right) => left.localeCompare(right)),
        durationMs: validation.durationMs
    };
}

function createEvidenceSummary(report: RunReport): string[] {
    if (report.failureAnalysis?.evidence?.length) {
        return report.failureAnalysis.evidence.slice(0, 5);
    }

    const summary: string[] = [];

    if (report.validation?.skipReason) {
        summary.push(report.validation.skipReason);
    }

    for (const issue of report.validation?.issues || []) {
        summary.push(issue.message);
    }

    return summary.slice(0, 5);
}

function createStateDigest({
    fingerprintDigest,
    core,
    javaProfile,
    validationTimeoutMs,
    launchProfile,
    currentModDecisions
}: {
    fingerprintDigest: string;
    core: string | null;
    javaProfile: string | null;
    validationTimeoutMs: number | null;
    launchProfile: CandidateState['launchProfile'];
    currentModDecisions: CandidateState['currentModDecisions'];
}): string {
    const payload = {
        fingerprintDigest,
        core: core || null,
        javaProfile: javaProfile || null,
        validationTimeoutMs,
        validationEntrypointKind: launchProfile.validationEntrypointKind || null,
        validationEntrypointPath: launchProfile.validationEntrypointPath || null,
        decisions: currentModDecisions
            .map((decision) => ({
                fileName: decision.fileName,
                buildDecision: decision.buildDecision || null
            }))
            .sort((left, right) => left.fileName.localeCompare(right.fileName))
    };

    return crypto
        .createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');
}

function createOutcomeStatus(report: RunReport): CandidateState['outcomeStatus'] {
    const status = report.validation?.status;

    if (!report.validation || !report.validation.runAttempted) {
        return report.validation?.status === 'skipped' ? 'skipped' : 'not-run';
    }

    return status === 'passed' ? 'passed' : 'failed';
}

function createCandidateState({
    runContext,
    report,
    candidateId,
    parentCandidateId = null,
    iteration = 0,
    appliedFixes = [],
    terminalOutcome = null
}: {
    runContext: RunContext;
    report: RunReport;
    candidateId: string;
    parentCandidateId?: string | null;
    iteration?: number;
    appliedFixes?: CandidateState['appliedFixes'];
    terminalOutcome?: ResolvedTerminalOutcome | null;
}): CandidateState {
    const failureAnalysis = report.failureAnalysis || (report.releaseContract
        ? normalizeFailureAnalysis({
            supportBoundary: report.releaseContract.supportBoundary,
            trustPolicy: report.releaseContract.trustPolicy,
            validation: report.validation || null
        })
        : null);
    const fingerprint = createCandidateFingerprint({
        runContext,
        decisions: (report.decisions || []) as Array<Record<string, any>>
    });
    const launchProfile = {
        validationEntrypointKind: report.validation?.entrypoint?.kind || null,
        validationEntrypointPath: report.validation?.entrypoint?.originalPath || null
    };
    const currentModDecisions = (report.decisions || []).map((decision) => ({
        fileName: decision.fileName,
        finalDecision: decision.finalSemanticDecision || null,
        buildDecision: decision.decision || null,
        actionStatus: decision.actionStatus || null,
        roleType: decision.finalRoleType || null,
        reason: decision.reason,
        topologyPartition: decision.topologyPartition || null,
        topologyReason: decision.topologyReason || null
    }));
    const stateDigest = createStateDigest({
        fingerprintDigest: fingerprint.digest,
        core: report.serverCoreInstall?.coreType || report.runtimeDetection?.supportedServerCore || null,
        javaProfile: null,
        validationTimeoutMs: runContext.validationTimeoutMs,
        launchProfile,
        currentModDecisions
    });

    return {
        candidateId,
        parentCandidateId,
        iteration,
        stateDigest,
        fingerprint,
        runtimeTopologyId: report.releaseContract?.supportBoundary.runtimeTopology.topologyId || null,
        loader: detectSingleLoader(report),
        connectorLayer: report.releaseContract?.supportBoundary.runtimeTopology.connectorLayer || null,
        bridgedEcosystem: report.releaseContract?.supportBoundary.runtimeTopology.bridgedEcosystem || null,
        core: report.serverCoreInstall?.coreType || report.runtimeDetection?.supportedServerCore || null,
        javaProfile: null,
        validationTimeoutMs: runContext.validationTimeoutMs,
        launchProfile,
        currentModDecisions,
        appliedFixes: [...appliedFixes],
        validation: createValidationSnapshot(report),
        failureFamily: failureAnalysis ? failureAnalysis.family : inferPreliminaryFailureFamily(report.validation || null),
        failureAnalysis,
        evidenceSummary: createEvidenceSummary(report),
        terminalOutcomeId: terminalOutcome ? terminalOutcome.id : null,
        shortExplanation: terminalOutcome ? terminalOutcome.explanation : null,
        outcomeStatus: createOutcomeStatus(report)
    };
}

function createInitialCandidateState({
    runContext,
    report
}: {
    runContext: RunContext;
    report: RunReport;
}): CandidateState {
    return createCandidateState({
        runContext,
        report,
        candidateId: `${runContext.runId}:candidate-0`
    });
}

function attachTerminalOutcomeToCandidate({
    candidate,
    terminalOutcome
}: {
    candidate: CandidateState;
    terminalOutcome: ResolvedTerminalOutcome;
}): CandidateState {
    return {
        ...candidate,
        terminalOutcomeId: terminalOutcome.id,
        shortExplanation: terminalOutcome.explanation
    };
}

function createSyntheticCandidateTrace({
    runContext,
    report
}: {
    runContext: RunContext;
    report: RunReport;
}): CandidateTrace {
    const initialCandidate = createInitialCandidateState({
        runContext,
        report
    });

    return {
        currentCandidateId: initialCandidate.candidateId,
        candidates: [initialCandidate],
        fingerprintDigests: [initialCandidate.fingerprint.digest],
        searchBudget: createDefaultSearchBudget({
            runContext,
            candidateStates: 1
        })
    };
}

module.exports = {
    attachTerminalOutcomeToCandidate,
    createCandidateState,
    createInitialCandidateState,
    createSyntheticCandidateTrace
};
