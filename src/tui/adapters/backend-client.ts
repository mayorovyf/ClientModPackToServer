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
    stderrLines: string[];
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

    if (form.reportDir.trim()) {
        args.push('--report-dir', form.reportDir.trim());
    }

    if (form.dryRun) {
        args.push('--dry-run');
    }

    return args;
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
    onStderr
}: {
    form: RunFormState;
    onEvent?: (event: BackendEvent) => void;
    onStderr?: (line: string) => void;
}): Promise<BackendRunResult> {
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

    child.stdout?.on('data', (chunk: Buffer) => {
        stdoutBuffer += chunk.toString('utf8');
        const lines = stdoutBuffer.split(/\r?\n/);
        stdoutBuffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();

            if (!trimmed) {
                continue;
            }

            try {
                const event = JSON.parse(trimmed) as BackendEvent;

                if (event.type === 'report.written') {
                    reportPath = typeof event.payload.jsonReportPath === 'string' ? event.payload.jsonReportPath : reportPath;
                    summaryPath = typeof event.payload.summaryPath === 'string' ? event.payload.summaryPath : summaryPath;
                    reportDir = typeof event.payload.reportDir === 'string' ? event.payload.reportDir : reportDir;
                }

                onEvent?.(event);
            } catch {
                onStderr?.(`Unparsed backend output: ${trimmed}`);
            }
        }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
        stderrBuffer += chunk.toString('utf8');
        const lines = stderrBuffer.split(/\r?\n/);
        stderrBuffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();

            if (!trimmed) {
                continue;
            }

            stderrLines.push(trimmed);
            onStderr?.(trimmed);
        }
    });

    const closeResult = await new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
        child.on('error', reject);
        child.on('close', (exitCode, signal) => resolve({ exitCode, signal }));
    });

    return {
        ...closeResult,
        report: await readReport(reportPath),
        reportPath,
        summaryPath,
        reportDir,
        stderrLines
    };
}
