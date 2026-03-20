export const BACKEND_EVENT_TYPES = Object.freeze({
    runStarted: 'run.started',
    runFailed: 'run.failed',
    registryLoaded: 'registry.loaded',
    stageStarted: 'stage.started',
    stageCompleted: 'stage.completed',
    modParsed: 'mod.parsed',
    classificationCompleted: 'classification.completed',
    dependencyAnalysisCompleted: 'dependency.analysis.completed',
    arbiterReviewFound: 'arbiter.review-found',
    deepCheckCompleted: 'deep-check.completed',
    validationCompleted: 'validation.completed',
    buildActionCompleted: 'build.action.completed',
    convergenceCandidateStarted: 'convergence.candidate.started',
    convergencePlanSelected: 'convergence.plan.selected',
    convergenceCandidateCompleted: 'convergence.candidate.completed',
    convergenceTerminalOutcome: 'convergence.terminal-outcome',
    reportWritten: 'report.written',
    runFinished: 'run.finished'
});

export type BackendEventType = (typeof BACKEND_EVENT_TYPES)[keyof typeof BACKEND_EVENT_TYPES];
