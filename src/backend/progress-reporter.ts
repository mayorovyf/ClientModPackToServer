import type { BackendEventEmitter } from './event-emitter';
import type {
    BuildProgressReporter,
    ProgressConvergenceEvent,
    ProgressBuildActionEvent,
    ProgressModEvent,
    ProgressStageActivityEvent,
    ProgressStageEvent
} from '../types/app';
import { BACKEND_EVENT_TYPES } from './event-types';

function normalizeModIds(rawValue: unknown): string[] {
    if (!Array.isArray(rawValue)) {
        return [];
    }

    return rawValue.filter((value): value is string => typeof value === 'string');
}

function getIssueCount(rawValue: unknown): number {
    return Array.isArray(rawValue) ? rawValue.length : 0;
}

function normalizeStringArray(rawValue: unknown): string[] {
    if (!Array.isArray(rawValue)) {
        return [];
    }

    return rawValue.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function createConvergencePayload(event: ProgressConvergenceEvent): Record<string, unknown> {
    return {
        candidateId: typeof event.candidateId === 'string' ? event.candidateId : null,
        parentCandidateId: typeof event.parentCandidateId === 'string' ? event.parentCandidateId : null,
        nextCandidateId: typeof event.nextCandidateId === 'string' ? event.nextCandidateId : null,
        iteration: typeof event.iteration === 'number' ? event.iteration : null,
        nextIteration: typeof event.nextIteration === 'number' ? event.nextIteration : null,
        loopStage: typeof event.loopStage === 'string' ? event.loopStage : null,
        failureFamily: typeof event.failureFamily === 'string' ? event.failureFamily : null,
        outcomeStatus: typeof event.outcomeStatus === 'string' ? event.outcomeStatus : null,
        stateDigest: typeof event.stateDigest === 'string' ? event.stateDigest : null,
        appliedFixKinds: normalizeStringArray(event.appliedFixKinds),
        newlyAppliedFixKinds: normalizeStringArray(event.newlyAppliedFixKinds),
        terminalOutcomeId: typeof event.terminalOutcomeId === 'string' ? event.terminalOutcomeId : null,
        terminalOutcomeExplanation: typeof event.terminalOutcomeExplanation === 'string'
            ? event.terminalOutcomeExplanation
            : null,
        reasonCode: typeof event.reasonCode === 'string' ? event.reasonCode : null,
        candidateCount: typeof event.candidateCount === 'number' ? event.candidateCount : null,
        searchBudget: event.searchBudget || null
    };
}

function createStageActivityPayload(event: ProgressStageActivityEvent): Record<string, unknown> {
    return {
        stage: typeof event.stage === 'string' ? event.stage : null,
        message: typeof event.message === 'string' ? event.message : null,
        activityType: typeof event.activityType === 'string' ? event.activityType : null,
        fileName: typeof event.fileName === 'string' ? event.fileName : null,
        index: typeof event.index === 'number' ? event.index : null,
        total: typeof event.total === 'number' ? event.total : null,
        loader: typeof event.loader === 'string' ? event.loader : null,
        decision: typeof event.decision === 'string' ? event.decision : null,
        actionStatus: typeof event.actionStatus === 'string' ? event.actionStatus : null,
        supportCount: typeof event.supportCount === 'number' ? event.supportCount : null,
        coreType: typeof event.coreType === 'string' ? event.coreType : null,
        minecraftVersion: typeof event.minecraftVersion === 'string' ? event.minecraftVersion : null,
        loaderVersion: typeof event.loaderVersion === 'string' ? event.loaderVersion : null,
        entrypointPath: typeof event.entrypointPath === 'string' ? event.entrypointPath : null,
        attempt: typeof event.attempt === 'number' ? event.attempt : null,
        maxAttempts: typeof event.maxAttempts === 'number' ? event.maxAttempts : null,
        javaProfile: typeof event.javaProfile === 'string' ? event.javaProfile : null,
        workspaceDir: typeof event.workspaceDir === 'string' ? event.workspaceDir : null
    };
}

export function createBuildProgressReporter({
    emitter,
    runId
}: {
    emitter: BackendEventEmitter;
    runId?: string | null;
}): BuildProgressReporter {
    return {
        onStageStarted(event) {
            emitter.emit(BACKEND_EVENT_TYPES.stageStarted, event, runId);
        },

        onStageCompleted(event) {
            emitter.emit(BACKEND_EVENT_TYPES.stageCompleted, event, runId);
        },

        onStageActivity(event) {
            emitter.emit(BACKEND_EVENT_TYPES.stageActivity, createStageActivityPayload(event), runId);
        },

        onModParsed(event) {
            const descriptor = event.descriptor || null;
            const classification = event.classification || null;

            emitter.emit(
                BACKEND_EVENT_TYPES.modParsed,
                {
                    fileName: event.fileName,
                    index: event.index ?? null,
                    total: event.total ?? null,
                    loader: descriptor?.loader || 'unknown',
                    modIds: normalizeModIds(descriptor?.modIds),
                    declaredSide: descriptor?.declaredSide || 'unknown',
                    parsingWarnings: getIssueCount(descriptor?.parsingWarnings),
                    parsingErrors: getIssueCount(descriptor?.parsingErrors),
                    classificationDecision: classification?.finalDecision || null,
                    classificationConfidence: classification?.confidence || 'none',
                    winningEngine: classification?.winningEngine || null,
                    hasConflict: Boolean(classification?.conflict?.hasConflict)
                },
                runId
            );
        },

        onBuildActionCompleted(event) {
            emitter.emit(
                BACKEND_EVENT_TYPES.buildActionCompleted,
                {
                    fileName: event.fileName,
                    index: event.index ?? null,
                    total: event.total ?? null,
                    decision: event.decision || null,
                    actionStatus: event.actionStatus || null,
                    finalSemanticDecision: event.finalSemanticDecision || null,
                    finalConfidence: event.finalConfidence || 'none',
                    decisionOrigin: event.decisionOrigin || null,
                    destinationPath: event.destinationPath || null,
                    error: event.error || null
                },
                runId
            );
        },

        onConvergenceCandidateStarted(event) {
            emitter.emit(
                BACKEND_EVENT_TYPES.convergenceCandidateStarted,
                createConvergencePayload(event),
                runId
            );
        },

        onConvergencePlanSelected(event) {
            emitter.emit(
                BACKEND_EVENT_TYPES.convergencePlanSelected,
                createConvergencePayload(event),
                runId
            );
        },

        onConvergenceCandidateCompleted(event) {
            emitter.emit(
                BACKEND_EVENT_TYPES.convergenceCandidateCompleted,
                createConvergencePayload(event),
                runId
            );
        },

        onConvergenceTerminalOutcome(event) {
            emitter.emit(
                BACKEND_EVENT_TYPES.convergenceTerminalOutcome,
                createConvergencePayload(event),
                runId
            );
        }
    };
}
