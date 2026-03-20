const path = require('node:path');
const { spawn } = require('node:child_process');

const { resolveJavaRuntimeForProfile } = require('../runtime/java-profile');
const { detectSuccessMarkers } = require('./markers');

import type { ValidationEntrypoint, ValidationProcessCommand, ValidationProcessRuntime } from '../types/validation';
import type { JavaProfileId } from '../types/topology';

function buildCommand(entrypoint: ValidationEntrypoint, javaProfile: JavaProfileId = 'auto'): ValidationProcessCommand {
    switch (entrypoint.kind) {
        case 'jar': {
            const resolvedJavaRuntime = resolveJavaRuntimeForProfile(javaProfile);

            if (!resolvedJavaRuntime.available || !resolvedJavaRuntime.command) {
                throw new Error(`Requested Java profile ${javaProfile} is not available in the trusted environment`);
            }

            return {
                command: resolvedJavaRuntime.command,
                args: ['-jar', path.basename(entrypoint.path), 'nogui']
            };
        }
        case 'node-script':
            return {
                command: process.execPath,
                args: [path.basename(entrypoint.path)]
            };
        case 'cmd-script':
            return {
                command: 'cmd.exe',
                args: ['/c', path.basename(entrypoint.path)]
            };
        case 'powershell-script':
            return {
                command: 'powershell.exe',
                args: ['-ExecutionPolicy', 'Bypass', '-File', path.basename(entrypoint.path)]
            };
        case 'executable':
            return {
                command: entrypoint.path,
                args: []
            };
        default:
            throw new Error(`Unsupported validation entrypoint kind: ${entrypoint.kind}`);
    }
}

function runValidationProcess({
    entrypoint,
    workingDirectory,
    timeoutMs,
    javaProfile = 'auto',
    record = () => {}
}: {
    entrypoint: ValidationEntrypoint;
    workingDirectory: string;
    timeoutMs: number;
    javaProfile?: JavaProfileId;
    record?: (level: string, kind: string, message: string) => void;
}): Promise<ValidationProcessRuntime> {
    const command = buildCommand(entrypoint, javaProfile);
    const startedAt = new Date().toISOString();
    const startedAtMs = Date.now();

    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        let combinedOutput = '';
        let exitCode: number | null = null;
        let signal: NodeJS.Signals | null = null;
        let timedOut = false;
        let spawnError: Error | null = null;
        let completionReason = 'process-exit';
        let finished = false;
        let successMarkers = detectSuccessMarkers('');
        let child: ReturnType<typeof spawn> | null = null;
        let timer: NodeJS.Timeout | null = null;

        function finish(): void {
            if (finished) {
                return;
            }

            finished = true;

            if (timer) {
                clearTimeout(timer);
            }

            resolve({
                startedAt,
                finishedAt: new Date().toISOString(),
                durationMs: Date.now() - startedAtMs,
                command,
                exitCode,
                signal,
                timedOut,
                spawnError,
                completionReason,
                stdout,
                stderr,
                combinedOutput,
                successMarkers
            });
        }

        function appendOutput(streamName: 'stdout' | 'stderr', chunk: Buffer): void {
            const text = chunk.toString('utf8');

            if (streamName === 'stdout') {
                stdout += text;
            } else {
                stderr += text;
            }

            combinedOutput += text;
            const nextMarkers = detectSuccessMarkers(combinedOutput);

            if (nextMarkers.length > successMarkers.length) {
                successMarkers = nextMarkers;
                record('success', 'validation', `Validation success marker detected: ${nextMarkers[nextMarkers.length - 1].label}`);

                if (child && !timedOut) {
                    completionReason = 'success-marker';
                    setTimeout(() => {
                        if (child && child.exitCode === null) {
                            child.kill();
                        }
                    }, 50);
                }
            }
        }

        record('info', 'validation', `Starting validation process: ${command.command} ${command.args.join(' ')}`.trim());

        try {
            child = spawn(command.command, command.args, {
                cwd: workingDirectory,
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true
            });
        } catch (error) {
            spawnError = error instanceof Error ? error : new Error(String(error));
            completionReason = 'spawn-error';
            finish();
            return;
        }

        timer = setTimeout(() => {
            timedOut = true;
            completionReason = 'timeout';
            record('warn', 'validation-warn', `Validation timed out after ${timeoutMs}ms`);

            if (child && child.exitCode === null) {
                child.kill();
            }
        }, timeoutMs);

        child.stdout?.on('data', (chunk: Buffer) => appendOutput('stdout', chunk));
        child.stderr?.on('data', (chunk: Buffer) => appendOutput('stderr', chunk));

        child.on('error', (error: Error) => {
            spawnError = error;
            completionReason = 'spawn-error';
            finish();
        });

        child.on('close', (nextExitCode: number | null, nextSignal: NodeJS.Signals | null) => {
            exitCode = nextExitCode;
            signal = nextSignal;
            finish();
        });
    });
}

module.exports = {
    buildCommand,
    runValidationProcess
};
