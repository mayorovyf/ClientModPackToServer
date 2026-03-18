import type { BackendEvent } from '../types/events';
import type { BackendEventType } from './event-types';
import { createNdjsonWriter, type NdjsonWriter } from './ndjson-writer';

export interface BackendEventEmitter {
    emit: (type: BackendEventType, payload?: Record<string, unknown>, runId?: string | null) => BackendEvent;
}

export function createBackendEventEmitter({
    writer = createNdjsonWriter(),
    runId = null
}: {
    writer?: NdjsonWriter;
    runId?: string | null;
} = {}): BackendEventEmitter {
    return {
        emit(type: BackendEventType, payload: Record<string, unknown> = {}, eventRunId = runId) {
            const event: BackendEvent = {
                type,
                timestamp: new Date().toISOString(),
                payload
            };

            if (eventRunId) {
                event.runId = eventRunId;
            }

            writer.write(event);
            return event;
        }
    };
}
