import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import type { BackendEvent } from '../../types/events.js';
import type { RunReport } from '../../types/report.js';
import type { RunFormState } from '../state/app-state.js';

const require = createRequire(import.meta.url);
const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
const tsxCliPath = require.resolve('tsx/cli');
const backendRunnerPath = path.resolve(currentDirectory, '..', '..', 'backend', 'headless-runner.ts');

export interface BackendRunResult {
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    report: RunReport | null;
    reportPath: string | null;
    summaryPath: string | null;
    reportDir: string | null;
    eventsLogPath: string | null;
    stderrLines: string[];
}

interface ParsedLineBuffer {
    lines: string[];
    remainder: string;
}

function parseMultiValueInput(value: string): string[] {
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

export function buildHeadlessRunnerArgs(form: RunFormState): string[] {
    const args = [
        '--input', form.inputPath,
        '--profile', form.profile,
        '--deep-check', form.deepCheckMode,
        '--validation', form.validationMode,
        '--registry-mode', form.registryMode
    ];

    if (form.outputPath.trim()) {
        args.push('--output', form.outputPath.trim());
    }

    if (form.serverDirName.trim()) {
        args.push('--server-dir-name', form.serverDirName.trim());
    }

    if (form.reportDir.trim()) {
        args.push('--report-dir', form.reportDir.trim());
    }

    if (form.runIdPrefix.trim()) {
        args.push('--run-id-prefix', form.runIdPrefix.trim());
    }

    if (form.validationTimeoutMs.trim()) {
        args.push('--validation-timeout-ms', form.validationTimeoutMs.trim());
    }

    if (form.validationEntrypointPath.trim()) {
        args.push('--validation-entrypoint', form.validationEntrypointPath.trim());
    }

    if (form.validationSaveArtifacts) {
        args.push('--validation-save-artifacts');
    }

    if (form.registryManifestUrl.trim()) {
        args.push('--registry-manifest-url', form.registryManifestUrl.trim());
    }

    if (form.registryBundleUrl.trim()) {
        args.push('--registry-bundle-url', form.registryBundleUrl.trim());
    }

    if (form.registryFilePath.trim()) {
        args.push('--registry-file', form.registryFilePath.trim());
    }

    if (form.registryOverridesPath.trim()) {
        args.push('--registry-overrides', form.registryOverridesPath.trim());
    }

    const enabledEngines = parseMultiValueInput(form.enabledEngineNames);

    if (enabledEngines.length > 0) {
        args.push('--engine', enabledEngines.join(','));
    }

    const disabledEngines = parseMultiValueInput(form.disabledEngineNames);

    if (disabledEngines.length > 0) {
        args.push('--disable-engine', disabledEngines.join(','));
    }

    if (form.dryRun) {
        args.push('--dry-run');
    }

    return args;
}

export function splitBufferedLines(buffer: string): ParsedLineBuffer {
    const parts = buffer.split(/\r?\n/);
    const remainder = parts.pop() || '';

    return {
        lines: parts.map((line) => line.trim()).filter(Boolean),
        remainder
    };
}

export function createAbortError(): Error {
    const error = new Error('Backend run aborted');
    error.name = 'AbortError';
    return error;
}

async function readReport(reportPath: string | null): Promise<RunReport | null> {
    if (!reportPath) {
        return null;
    }

    try {
        const raw = await fs.readFile(reportPath, 'utf8');
        return JSON.parse(raw) as RunReport;
    } catch {
        return null;
    }
}

export async function runHeadlessBackend({
    form,
    onEvent,
    onStderr,
    signal
}: {
    form: RunFormState;
    onEvent?: (event: BackendEvent) => void;
    onStderr?: (line: string) => void;
    signal?: AbortSignal;
}): Promise<BackendRunResult> {
    if (signal?.aborted) {
        throw createAbortError();
    }

    const args = buildHeadlessRunnerArgs(form);
    const child = spawn(process.execPath, [tsxCliPath, backendRunnerPath, ...args], {
        cwd: path.resolve(currentDirectory, '..', '..', '..'),
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
    });

    let stdoutBuffer = '';
    let stderrBuffer = '';
    const stderrLines: string[] = [];
    let reportPath: string | null = null;
    let summaryPath: string | null = null;
    let reportDir: string | null = null;
    let eventsLogPath: string | null = null;

    function handleStdoutLine(trimmed: string): void {
        try {
            const event = JSON.parse(trimmed) as BackendEvent;

            if (event.type === 'report.written') {
                reportPath = typeof event.payload.jsonReportPath === 'string' ? event.payload.jsonReportPath : reportPath;
                summaryPath = typeof event.payload.summaryPath === 'string' ? event.payload.summaryPath : summaryPath;
                reportDir = typeof event.payload.reportDir === 'string' ? event.payload.reportDir : reportDir;
                eventsLogPath = typeof event.payload.eventsLogPath === 'string' ? event.payload.eventsLogPath : eventsLogPath;
            }

            onEvent?.(event);
        } catch {
            onStderr?.(`Unparsed backend output: ${trimmed}`);
        }
    }

    function handleStderrLine(trimmed: string): void {
        stderrLines.push(trimmed);
        onStderr?.(trimmed);
    }

    child.stdout?.on('data', (chunk: Buffer) => {
        stdoutBuffer += chunk.toString('utf8');
        const parsed = splitBufferedLines(stdoutBuffer);
        stdoutBuffer = parsed.remainder;

        for (const line of parsed.lines) {
            handleStdoutLine(line);
        }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
        stderrBuffer += chunk.toString('utf8');
        const parsed = splitBufferedLines(stderrBuffer);
        stderrBuffer = parsed.remainder;

        for (const line of parsed.lines) {
            handleStderrLine(line);
        }
    });

    const abortChild = () => {
        if (!child.killed) {
            child.kill();
        }
    };

    signal?.addEventListener('abort', abortChild, { once: true });

    const closeResult = await new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
        child.on('error', reject);
        child.on('close', (exitCode, signal) => resolve({ exitCode, signal }));
    });

    signal?.removeEventListener('abort', abortChild);

    const pendingStdout = stdoutBuffer.trim();

    if (pendingStdout) {
        handleStdoutLine(pendingStdout);
    }

    const pendingStderr = stderrBuffer.trim();

    if (pendingStderr) {
        handleStderrLine(pendingStderr);
    }

    if (signal?.aborted) {
        throw createAbortError();
    }

    return {
        ...closeResult,
        report: await readReport(reportPath),
        reportPath,
        summaryPath,
        reportDir,
        eventsLogPath,
        stderrLines
    };
}
