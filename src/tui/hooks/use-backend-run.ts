import { useEffect, useRef, useState } from 'react';

import type { BackendEvent } from '../../types/events.js';
import { applyBackendEvent, createInitialRunSessionState, createRunningSessionState } from '../state/app-state.js';
import type { RunFormState, RunSessionState } from '../state/app-state.js';
import { createAbortError, runHeadlessBackend } from '../adapters/backend-client.js';
import type { BackendRunResult } from '../adapters/backend-client.js';

export function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
}

export function formatBackendExitMessage({
    exitCode,
    signal
}: {
    exitCode: number | null;
    signal: NodeJS.Signals | null;
}): string {
    if (typeof exitCode === 'number') {
        return `Backend exited with code ${exitCode}`;
    }

    if (signal) {
        return `Backend exited with signal ${signal}`;
    }

    return 'Backend exited unexpectedly';
}

function getReportCurrentCandidate(report: BackendRunResult['report']) {
    if (!report?.candidateTrace?.candidates?.length) {
        return null;
    }

    return report.candidateTrace.candidates.find((candidate) => candidate.candidateId === report.candidateTrace?.currentCandidateId)
        || report.candidateTrace.candidates[report.candidateTrace.candidates.length - 1]
        || null;
}

export function finalizeSessionAfterBackendRun(previous: RunSessionState, result: BackendRunResult): RunSessionState {
    const exitedSuccessfully = result.exitCode === 0 && result.signal === null;
    const alreadyFailed = previous.status === 'failed';
    const status = !alreadyFailed && exitedSuccessfully ? 'succeeded' : 'failed';
    const lastError = status === 'succeeded'
        ? null
        : previous.lastError || formatBackendExitMessage(result);
    const currentCandidate = getReportCurrentCandidate(result.report);

    return {
        ...previous,
        status,
        currentStage: null,
        currentConvergenceStage: null,
        currentCandidateId: currentCandidate?.candidateId || previous.currentCandidateId,
        currentIteration: typeof currentCandidate?.iteration === 'number' ? currentCandidate.iteration : previous.currentIteration,
        candidateCount: result.report?.candidateTrace?.candidates.length ?? previous.candidateCount,
        terminalOutcomeId: result.report?.terminalOutcome?.id || previous.terminalOutcomeId,
        terminalOutcomeExplanation: result.report?.terminalOutcome?.explanation || previous.terminalOutcomeExplanation,
        lastReport: result.report,
        reportPaths: {
            reportDir: result.reportDir,
            jsonReportPath: result.reportPath,
            summaryPath: result.summaryPath,
            eventsLogPath: result.eventsLogPath,
            recipePath: result.recipePath,
            candidatesPath: result.candidatesPath
        },
        lastError
    };
}

export function useBackendRun(): {
    session: RunSessionState;
    startRun: (form: RunFormState) => Promise<void>;
    cancelRun: () => void;
    resetSession: () => void;
} {
    const [session, setSession] = useState<RunSessionState>(createInitialRunSessionState);
    const activeRunControllerRef = useRef<AbortController | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        return () => {
            mountedRef.current = false;
            activeRunControllerRef.current?.abort(createAbortError());
        };
    }, []);

    async function startRun(form: RunFormState): Promise<void> {
        if (activeRunControllerRef.current && !activeRunControllerRef.current.signal.aborted) {
            return;
        }

        const controller = new AbortController();
        activeRunControllerRef.current = controller;
        setSession(createRunningSessionState());

        try {
            const result = await runHeadlessBackend({
                form,
                signal: controller.signal,
                onEvent(event: BackendEvent) {
                    if (!mountedRef.current || activeRunControllerRef.current !== controller) {
                        return;
                    }

                    setSession((previous) => applyBackendEvent(previous, event));
                },
                onStderr(line: string) {
                    if (!mountedRef.current || activeRunControllerRef.current !== controller) {
                        return;
                    }

                    setSession((previous) => ({
                        ...previous,
                        lastError: previous.lastError || line
                    }));
                }
            });

            if (!mountedRef.current || activeRunControllerRef.current !== controller) {
                return;
            }

            setSession((previous) => finalizeSessionAfterBackendRun(previous, result));
        } catch (error) {
            if (!mountedRef.current || activeRunControllerRef.current !== controller || isAbortError(error)) {
                return;
            }

            setSession((previous) => ({
                ...previous,
                status: 'failed',
                currentStage: null,
                lastError: error instanceof Error ? error.message : String(error)
            }));
        } finally {
            if (activeRunControllerRef.current === controller) {
                activeRunControllerRef.current = null;
            }
        }
    }

    function cancelRun(): void {
        activeRunControllerRef.current?.abort(createAbortError());
    }

    function resetSession(): void {
        setSession(createInitialRunSessionState());
    }

    return {
        session,
        startRun,
        cancelRun,
        resetSession
    };
}
