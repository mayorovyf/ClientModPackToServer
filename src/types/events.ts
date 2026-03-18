export interface BackendEventPayload {
    [key: string]: unknown;
}

export interface BackendEvent {
    type: string;
    timestamp: string;
    runId?: string;
    payload: BackendEventPayload;
}

export interface RunStartedEvent extends BackendEvent {
    type: 'run.started';
}

export interface RegistryLoadedEvent extends BackendEvent {
    type: 'registry.loaded';
}

export interface StageStartedEvent extends BackendEvent {
    type: 'stage.started';
}

export interface StageCompletedEvent extends BackendEvent {
    type: 'stage.completed';
}

export interface ModParsedEvent extends BackendEvent {
    type: 'mod.parsed';
}

export interface ClassificationCompletedEvent extends BackendEvent {
    type: 'classification.completed';
}

export interface DependencyAnalysisCompletedEvent extends BackendEvent {
    type: 'dependency.analysis.completed';
}

export interface ArbiterReviewFoundEvent extends BackendEvent {
    type: 'arbiter.review-found';
}

export interface DeepCheckCompletedEvent extends BackendEvent {
    type: 'deep-check.completed';
}

export interface ValidationCompletedEvent extends BackendEvent {
    type: 'validation.completed';
}

export interface BuildActionCompletedEvent extends BackendEvent {
    type: 'build.action.completed';
}

export interface ReportWrittenEvent extends BackendEvent {
    type: 'report.written';
}

export interface RunFinishedEvent extends BackendEvent {
    type: 'run.finished';
}

export interface RunFailedEvent extends BackendEvent {
    type: 'run.failed';
}
