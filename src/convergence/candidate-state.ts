const { createCandidateFingerprint } = require('./candidate-fingerprint');
const { createDefaultSearchBudget } = require('./search-budget');
const { inferPreliminaryFailureFamily, normalizeFailureAnalysis } = require('../failure/family');

import type { CandidateState, CandidateTrace } from './types';
import type { RunReport } from '../types/report';
import type { RunContext } from '../types/run';
import type { LoaderKind } from '../types/metadata';

function detectSingleLoader(report: RunReport): LoaderKind | null {
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

function createOutcomeStatus(report: RunReport): CandidateState['outcomeStatus'] {
    const status = report.validation?.status;

    if (!report.validation || !report.validation.runAttempted) {
        return report.validation?.status === 'skipped' ? 'skipped' : 'not-run';
    }

    return status === 'passed' ? 'passed' : 'failed';
}

function createInitialCandidateState({
    runContext,
    report
}: {
    runContext: RunContext;
    report: RunReport;
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

    return {
        candidateId: `${runContext.runId}:candidate-0`,
        parentCandidateId: null,
        iteration: 0,
        fingerprint,
        loader: detectSingleLoader(report),
        core: null,
        javaProfile: null,
        launchProfile: {
            validationEntrypointKind: report.validation?.entrypoint?.kind || null,
            validationEntrypointPath: report.validation?.entrypoint?.originalPath || null
        },
        currentModDecisions: (report.decisions || []).map((decision) => ({
            fileName: decision.fileName,
            finalDecision: decision.finalSemanticDecision || null,
            buildDecision: decision.decision || null,
            actionStatus: decision.actionStatus || null,
            roleType: decision.finalRoleType || null,
            reason: decision.reason
        })),
        appliedFixes: [],
        validation: createValidationSnapshot(report),
        failureFamily: failureAnalysis ? failureAnalysis.family : inferPreliminaryFailureFamily(report.validation || null),
        failureAnalysis,
        evidenceSummary: createEvidenceSummary(report),
        outcomeStatus: createOutcomeStatus(report)
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
    createInitialCandidateState,
    createSyntheticCandidateTrace
};
