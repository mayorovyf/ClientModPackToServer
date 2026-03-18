const path = require('path');
const { spawn } = require('child_process');

const { detectSuccessMarkers } = require('./markers');

function buildCommand(entrypoint) {
    switch (entrypoint.kind) {
        case 'jar':
            return {
                command: 'java',
                args: ['-jar', path.basename(entrypoint.path), 'nogui']
            };
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

function runValidationProcess({ entrypoint, workingDirectory, timeoutMs, record = () => {} }) {
    const command = buildCommand(entrypoint);
    const startedAt = new Date().toISOString();
    const startedAtMs = Date.now();

    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        let combinedOutput = '';
        let exitCode = null;
        let signal = null;
        let timedOut = false;
        let spawnError = null;
        let completionReason = 'process-exit';
        let finished = false;
        let successMarkers = [];
        let child = null;
        let timer = null;

        function finish() {
            if (finished) {
                return;
            }

            finished = true;
            clearTimeout(timer);

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

        function appendOutput(streamName, chunk) {
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
            spawnError = error;
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

        child.stdout.on('data', (chunk) => appendOutput('stdout', chunk));
        child.stderr.on('data', (chunk) => appendOutput('stderr', chunk));

        child.on('error', (error) => {
            spawnError = error;
            completionReason = 'spawn-error';
            finish();
        });

        child.on('close', (nextExitCode, nextSignal) => {
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
