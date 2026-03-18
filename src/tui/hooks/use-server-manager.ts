import { useEffect, useRef, useState } from 'react';

import entrypointApi from '../../server/entrypoint.js';
import coreInstallerApi from '../../server/core-installer.js';
import runtimeApi from '../../server/runtime.js';
import type { ServerCoreInstallResult } from '../../server/types.js';

import type { ServerFormState } from '../state/app-state.js';

const { resolveManagedServerEntrypoint } = entrypointApi;
const { installServerCore } = coreInstallerApi;
const { ensureServerEulaAccepted, startManagedServerProcess } = runtimeApi;

type InstallStatus = 'idle' | 'installing' | 'installed' | 'failed';
type LaunchStatus = 'stopped' | 'starting' | 'running' | 'failed';

export interface ServerManagerState {
    installStatus: InstallStatus;
    launchStatus: LaunchStatus;
    lastError: string | null;
    logs: string[];
    resolvedEntrypointPath: string | null;
    lastInstall: ServerCoreInstallResult | null;
}

function appendServerLog(logs: string[], line: string): string[] {
    const nextLogs = [...logs, line];
    return nextLogs.slice(-120);
}

function createInitialServerManagerState(): ServerManagerState {
    return {
        installStatus: 'idle',
        launchStatus: 'stopped',
        lastError: null,
        logs: [],
        resolvedEntrypointPath: null,
        lastInstall: null
    };
}

export function useServerManager(): {
    state: ServerManagerState;
    installCore: (form: ServerFormState) => Promise<void>;
    launchServer: (form: ServerFormState) => Promise<void>;
    stopServer: () => void;
    clearLogs: () => void;
    setResolvedEntrypointPath: (value: string | null) => void;
} {
    const [state, setState] = useState<ServerManagerState>(createInitialServerManagerState);
    const processRef = useRef<ReturnType<typeof startManagedServerProcess> | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        return () => {
            mountedRef.current = false;

            if (processRef.current && !processRef.current.killed) {
                processRef.current.kill();
            }
        };
    }, []);

    async function installCore(form: ServerFormState): Promise<void> {
        if (state.installStatus === 'installing') {
            return;
        }

        setState((previous) => ({
            ...previous,
            installStatus: 'installing',
            lastError: null,
            logs: appendServerLog(previous.logs, `Installing ${form.coreType} core into ${form.targetDir || '<empty>'}...`)
        }));

        try {
            const result = await installServerCore({
                targetDir: form.targetDir,
                coreType: form.coreType,
                minecraftVersion: form.minecraftVersion,
                loaderVersion: form.loaderVersion,
                javaPath: form.javaPath,
                acceptEula: form.acceptEula
            });

            if (!mountedRef.current) {
                return;
            }

            setState((previous) => ({
                ...previous,
                installStatus: 'installed',
                lastError: null,
                resolvedEntrypointPath: result.entrypointPath,
                lastInstall: result,
                logs: result.notes.reduce(
                    (logs: string[], note: string) => appendServerLog(logs, note),
                    appendServerLog(previous.logs, `Core installation completed: ${result.coreType}`)
                )
            }));
        } catch (error) {
            if (!mountedRef.current) {
                return;
            }

            const message = error instanceof Error ? error.message : String(error);

            setState((previous) => ({
                ...previous,
                installStatus: 'failed',
                lastError: message,
                logs: appendServerLog(previous.logs, `Core installation failed: ${message}`)
            }));
        }
    }

    async function launchServer(form: ServerFormState): Promise<void> {
        if (processRef.current && !processRef.current.killed) {
            return;
        }

        setState((previous) => ({
            ...previous,
            launchStatus: 'starting',
            lastError: null,
            logs: appendServerLog(previous.logs, `Launching server from ${form.targetDir || '<empty>'}...`)
        }));

        try {
            if (form.acceptEula && form.targetDir.trim()) {
                ensureServerEulaAccepted(form.targetDir.trim());
            }

            const entrypoint = resolveManagedServerEntrypoint({
                serverDir: form.targetDir,
                explicitEntrypointPath: form.explicitEntrypointPath.trim() || state.resolvedEntrypointPath
            });

            if (!entrypoint) {
                throw new Error('Server launcher was not found in target directory');
            }

            const child = startManagedServerProcess({
                entrypoint,
                serverDir: form.targetDir,
                javaPath: form.javaPath,
                jvmArgs: form.jvmArgs
            });
            processRef.current = child;

            child.stdout?.on('data', (chunk: Buffer) => {
                if (!mountedRef.current) {
                    return;
                }

                const lines = chunk.toString('utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

                if (lines.length === 0) {
                    return;
                }

                setState((previous) => ({
                    ...previous,
                    logs: lines.reduce((logs, line) => appendServerLog(logs, line), previous.logs)
                }));
            });

            child.stderr?.on('data', (chunk: Buffer) => {
                if (!mountedRef.current) {
                    return;
                }

                const lines = chunk.toString('utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

                if (lines.length === 0) {
                    return;
                }

                setState((previous) => ({
                    ...previous,
                    logs: lines.reduce((logs, line) => appendServerLog(logs, `[stderr] ${line}`), previous.logs)
                }));
            });

            child.on('spawn', () => {
                if (!mountedRef.current) {
                    return;
                }

                setState((previous) => ({
                    ...previous,
                    launchStatus: 'running',
                    lastError: null,
                    resolvedEntrypointPath: entrypoint.path,
                    logs: appendServerLog(previous.logs, `Server process started: ${entrypoint.path}`)
                }));
            });

            child.on('error', (error: Error) => {
                if (!mountedRef.current) {
                    return;
                }

                processRef.current = null;
                setState((previous) => ({
                    ...previous,
                    launchStatus: 'failed',
                    lastError: error.message,
                    logs: appendServerLog(previous.logs, `Server process error: ${error.message}`)
                }));
            });

            child.on('close', (exitCode: number | null, signal: NodeJS.Signals | null) => {
                if (!mountedRef.current) {
                    return;
                }

                processRef.current = null;
                const wasGraceful = exitCode === 0 || signal === 'SIGTERM' || signal === 'SIGINT';
                const nextStatus: LaunchStatus = wasGraceful ? 'stopped' : 'failed';
                const closeMessage = typeof exitCode === 'number'
                    ? `Server exited with code ${exitCode}`
                    : signal
                        ? `Server exited with signal ${signal}`
                        : 'Server process closed';

                setState((previous) => ({
                    ...previous,
                    launchStatus: nextStatus,
                    lastError: nextStatus === 'failed' ? closeMessage : previous.lastError,
                    logs: appendServerLog(previous.logs, closeMessage)
                }));
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            setState((previous) => ({
                ...previous,
                launchStatus: 'failed',
                lastError: message,
                logs: appendServerLog(previous.logs, `Server launch failed: ${message}`)
            }));
        }
    }

    function stopServer(): void {
        if (!processRef.current || processRef.current.killed) {
            return;
        }

        processRef.current.kill();
        setState((previous) => ({
            ...previous,
            launchStatus: 'stopped',
            logs: appendServerLog(previous.logs, 'Stop signal sent to server process')
        }));
    }

    function clearLogs(): void {
        setState((previous) => ({
            ...previous,
            logs: []
        }));
    }

    function setResolvedEntrypointPath(value: string | null): void {
        setState((previous) => ({
            ...previous,
            resolvedEntrypointPath: value
        }));
    }

    return {
        state,
        installCore,
        launchServer,
        stopServer,
        clearLogs,
        setResolvedEntrypointPath
    };
}
