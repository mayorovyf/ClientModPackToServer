import { useState } from 'react';

import type { BackendEvent } from '../../types/events.js';
import { applyBackendEvent, createInitialRunSessionState, createRunningSessionState } from '../state/app-state.js';
import type { RunFormState, RunSessionState } from '../state/app-state.js';
import { runHeadlessBackend } from '../adapters/backend-client.js';

export function useBackendRun(): {
    session: RunSessionState;
    startRun: (form: RunFormState) => Promise<void>;
    resetSession: () => void;
} {
    const [session, setSession] = useState<RunSessionState>(createInitialRunSessionState);

    async function startRun(form: RunFormState): Promise<void> {
        setSession((previous) => createRunningSessionState(previous.lastReport));

        try {
            const result = await runHeadlessBackend({
                form,
                onEvent(event: BackendEvent) {
                    setSession((previous) => applyBackendEvent(previous, event));
                },
                onStderr(line: string) {
                    setSession((previous) => ({
                        ...previous,
                        lastError: previous.lastError || line
                    }));
                }
            });

            setSession((previous) => ({
                ...previous,
                status: result.exitCode === 0 && previous.status !== 'failed' ? 'succeeded' : previous.status,
                lastReport: result.report,
                reportPaths: {
                    reportDir: result.reportDir,
                    jsonReportPath: result.reportPath,
                    summaryPath: result.summaryPath,
                    eventsLogPath: previous.reportPaths.eventsLogPath
                },
                lastError: result.exitCode === 0 ? previous.lastError : previous.lastError || `Backend exited with code ${result.exitCode}`
            }));
        } catch (error) {
            setSession((previous) => ({
                ...previous,
                status: 'failed',
                currentStage: null,
                lastError: error instanceof Error ? error.message : String(error)
            }));
        }
    }

    function resetSession(): void {
        setSession(createInitialRunSessionState());
    }

    return {
        session,
        startRun,
        resetSession
    };
}
