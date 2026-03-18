import type { BackendEventEmitter } from './event-emitter';
import type {
    BuildProgressReporter,
    ProgressBuildActionEvent,
    ProgressModEvent,
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
        }
    };
}
