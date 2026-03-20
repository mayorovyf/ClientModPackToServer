import type { CandidateTrace } from '../convergence/types';
import type { MinimalRecipe } from './types';
import type { RunReport } from '../types/report';
import type { RunContext } from '../types/run';

function uniqueSorted(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function resolveRecipeOutcome(report: RunReport): MinimalRecipe['finalOutcome'] {
    if (report.terminalOutcome) {
        return {
            status: 'resolved',
            terminalOutcomeId: report.terminalOutcome.id,
            explanation: report.terminalOutcome.explanation
        };
    }

    if (report.releaseContract?.supportBoundary.status === 'unsupported') {
        return {
            status: 'resolved',
            terminalOutcomeId: 'not-automatable-within-boundaries',
            explanation: report.releaseContract.supportBoundary.summary
        };
    }

    if (report.failureAnalysis?.kind === 'policy-blocked') {
        return {
            status: 'resolved',
            terminalOutcomeId: 'not-automatable-within-boundaries',
            explanation: report.failureAnalysis.explanation
        };
    }

    return {
        status: 'provisional',
        terminalOutcomeId: null,
        explanation: 'Candidate history has been materialized, but no resolved terminal outcome was attached to this run.'
    };
}

function createMinimalRecipe({
    runContext,
    report,
    candidateTrace
}: {
    runContext: RunContext;
    report: RunReport;
    candidateTrace: CandidateTrace;
}): MinimalRecipe {
    const currentCandidate = candidateTrace.candidates.find((candidate) => candidate.candidateId === candidateTrace.currentCandidateId)
        || candidateTrace.candidates[candidateTrace.candidates.length - 1]
        || candidateTrace.candidates[0];
    const decisions = report.decisions || [];
    const fingerprint = currentCandidate ? currentCandidate.fingerprint : {
        algorithm: 'sha256' as const,
        digest: '',
        totalFiles: 0,
        detectedLoaders: [],
        inputKind: runContext.inputKind,
        instanceSource: runContext.instanceSource,
        files: []
    };
    const launchProfile = currentCandidate ? currentCandidate.launchProfile : {
        validationEntrypointKind: null,
        validationEntrypointPath: null
    };
    const appliedFixes = currentCandidate ? [...currentCandidate.appliedFixes] : [];

    return {
        schemaVersion: '1.0',
        sourceRunId: runContext.runId,
        inputFingerprint: fingerprint,
        selectedLoader: currentCandidate ? currentCandidate.loader : null,
        selectedCore: currentCandidate ? currentCandidate.core : null,
        selectedJavaProfile: currentCandidate ? currentCandidate.javaProfile : null,
        launchProfile: {
            validationEntrypointKind: launchProfile.validationEntrypointKind,
            validationEntrypointPath: launchProfile.validationEntrypointPath
        },
        decisions: {
            keep: uniqueSorted(decisions.filter((decision) => decision.decision === 'keep').map((decision) => decision.fileName)),
            remove: uniqueSorted(decisions.filter((decision) => decision.decision === 'exclude').map((decision) => decision.fileName)),
            add: []
        },
        appliedFixes,
        candidateIds: candidateTrace.candidates.map((candidate) => candidate.candidateId),
        finalOutcome: resolveRecipeOutcome(report)
    };
}

module.exports = {
    createMinimalRecipe
};
