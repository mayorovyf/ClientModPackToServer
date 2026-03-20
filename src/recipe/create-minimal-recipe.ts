import type { CandidateTrace } from '../convergence/types';
import type { MinimalRecipe } from './types';
import type { RunReport } from '../types/report';
import type { RunContext } from '../types/run';

function uniqueSorted(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function resolveRecipeOutcome(report: RunReport): MinimalRecipe['finalOutcome'] {
    if (report.releaseContract?.supportBoundary.status === 'unsupported') {
        return {
            status: 'resolved',
            terminalOutcomeId: 'not-automatable-within-boundaries',
            explanation: report.releaseContract.supportBoundary.summary
        };
    }

    return {
        status: 'provisional',
        terminalOutcomeId: null,
        explanation: 'The synthetic initial candidate has been materialized, but convergence loop terminal outcomes are not implemented yet.'
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
    const initialCandidate = candidateTrace.candidates[0];
    const decisions = report.decisions || [];
    const fingerprint = initialCandidate ? initialCandidate.fingerprint : {
        algorithm: 'sha256' as const,
        digest: '',
        totalFiles: 0,
        detectedLoaders: [],
        inputKind: runContext.inputKind,
        instanceSource: runContext.instanceSource,
        files: []
    };
    const launchProfile = initialCandidate ? initialCandidate.launchProfile : {
        validationEntrypointKind: null,
        validationEntrypointPath: null
    };
    const appliedFixes = initialCandidate ? [...initialCandidate.appliedFixes] : [];

    return {
        schemaVersion: '1.0',
        sourceRunId: runContext.runId,
        inputFingerprint: fingerprint,
        selectedLoader: initialCandidate ? initialCandidate.loader : null,
        selectedCore: initialCandidate ? initialCandidate.core : null,
        selectedJavaProfile: initialCandidate ? initialCandidate.javaProfile : null,
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
