import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import entrypointApi from './entrypoint.js';
import runtimeApi from './runtime.js';

import type { ManagedServerEntrypoint, ManagedServerEntrypointKind, ServerCoreType } from './types.js';

const { resolveManagedServerEntrypoint } = entrypointApi;
const { buildManagedServerCommand } = runtimeApi;

export type ServerPreflightMode = 'install' | 'launch';
export type ServerPreflightLevel = 'error' | 'warning' | 'info';

export interface ServerPreflightFinding {
    level: ServerPreflightLevel;
    code: string;
    message: string;
}

export interface ServerPreflightResult {
    ok: boolean;
    mode: ServerPreflightMode;
    coreType: ServerCoreType;
    targetDir: string | null;
    entrypoint: ManagedServerEntrypoint | null;
    commandPreview: string | null;
    findings: ServerPreflightFinding[];
}

function quoteShellArg(value: string): string {
    if (!/[ \t"]/g.test(value)) {
        return value;
    }

    return `"${value.replace(/"/g, '\\"')}"`;
}

function formatCommandPreview(command: string, args: string[]): string {
    return [command, ...args].map((part) => quoteShellArg(part)).join(' ');
}

function addFinding(findings: ServerPreflightFinding[], level: ServerPreflightLevel, code: string, message: string): void {
    findings.push({ level, code, message });
}

function probeJava(javaPath: string | null | undefined): string | null {
    const executable = javaPath && String(javaPath).trim() ? String(javaPath).trim() : 'java';
    const probe = spawnSync(executable, ['-version'], {
        encoding: 'utf8',
        windowsHide: true
    });

    if (probe.error) {
        return probe.error.message;
    }

    if (typeof probe.status === 'number' && probe.status !== 0) {
        const details = [probe.stderr, probe.stdout].map((value) => String(value || '').trim()).filter(Boolean).join('\n');
        return details || `java probe exited with code ${probe.status}`;
    }

    return null;
}

function readEulaState(targetDir: string): 'accepted' | 'missing' | 'rejected' {
    const eulaPath = path.join(targetDir, 'eula.txt');

    if (!fs.existsSync(eulaPath)) {
        return 'missing';
    }

    try {
        const content = fs.readFileSync(eulaPath, 'utf8');
        return /eula\s*=\s*true/i.test(content) ? 'accepted' : 'rejected';
    } catch {
        return 'missing';
    }
}

export function runServerPreflight({
    mode,
    targetDir,
    coreType = 'fabric',
    minecraftVersion = null,
    javaPath = null,
    explicitEntrypointPath = null,
    jvmArgs = null,
    acceptEula = false
}: {
    mode: ServerPreflightMode;
    targetDir: string | null | undefined;
    coreType?: ServerCoreType;
    minecraftVersion?: string | null | undefined;
    javaPath?: string | null | undefined;
    explicitEntrypointPath?: string | null | undefined;
    jvmArgs?: string | null | undefined;
    acceptEula?: boolean | undefined;
}): ServerPreflightResult {
    const findings: ServerPreflightFinding[] = [];
    const normalizedTargetDir = targetDir && String(targetDir).trim()
        ? path.resolve(String(targetDir).trim())
        : null;
    const normalizedMinecraftVersion = minecraftVersion && String(minecraftVersion).trim()
        ? String(minecraftVersion).trim()
        : null;
    const normalizedLauncherPath = explicitEntrypointPath && String(explicitEntrypointPath).trim()
        ? String(explicitEntrypointPath).trim()
        : null;
    const normalizedJvmArgs = jvmArgs && String(jvmArgs).trim()
        ? String(jvmArgs).trim()
        : null;
    let entrypoint: ManagedServerEntrypoint | null = null;
    let commandPreview: string | null = null;

    if (!normalizedTargetDir) {
        addFinding(findings, 'error', 'target-dir-required', 'Target server directory is required.');
    } else if (fs.existsSync(normalizedTargetDir) && !fs.statSync(normalizedTargetDir).isDirectory()) {
        addFinding(findings, 'error', 'target-dir-not-directory', `Target path is not a directory: ${normalizedTargetDir}`);
    } else if (mode === 'install' && !fs.existsSync(normalizedTargetDir)) {
        addFinding(findings, 'info', 'target-dir-create', `Target directory will be created: ${normalizedTargetDir}`);
    } else if (mode === 'launch' && !fs.existsSync(normalizedTargetDir)) {
        addFinding(findings, 'error', 'target-dir-missing', `Target server directory does not exist: ${normalizedTargetDir}`);
    }

    if (mode === 'install') {
        if (!normalizedMinecraftVersion) {
            addFinding(findings, 'error', 'minecraft-version-required', 'Minecraft version is required for server core installation.');
        }

        if (normalizedTargetDir && fs.existsSync(normalizedTargetDir)) {
            const entryCount = fs.readdirSync(normalizedTargetDir).length;

            if (entryCount > 0) {
                addFinding(findings, 'warning', 'target-dir-not-empty', 'Target server directory is not empty; installer will reuse existing contents.');
            }
        }

        if (coreType === 'forge' || coreType === 'neoforge') {
            const javaError = probeJava(javaPath);

            if (javaError) {
                addFinding(findings, 'error', 'java-unavailable', `Java is required for ${coreType} installation: ${javaError}`);
            } else {
                addFinding(findings, 'info', 'java-ready', 'Java runtime is available for installer-based core setup.');
            }
        } else if (javaPath && String(javaPath).trim()) {
            const javaError = probeJava(javaPath);

            if (javaError) {
                addFinding(findings, 'warning', 'java-probe-failed', `Explicit Java path could not be verified: ${javaError}`);
            }
        }
    }

    if (mode === 'launch' && normalizedTargetDir && fs.existsSync(normalizedTargetDir) && fs.statSync(normalizedTargetDir).isDirectory()) {
        try {
            entrypoint = resolveManagedServerEntrypoint({
                serverDir: normalizedTargetDir,
                explicitEntrypointPath: normalizedLauncherPath
            });
        } catch (error) {
            addFinding(findings, 'error', 'launcher-invalid', error instanceof Error ? error.message : String(error));
        }

        if (!entrypoint) {
            addFinding(findings, 'error', 'launcher-missing', 'Server launcher was not found in the target directory.');
        } else {
            addFinding(findings, 'info', 'launcher-ready', `Resolved launcher: ${entrypoint.path}`);

            if (entrypoint.kind === 'jar') {
                const javaError = probeJava(javaPath);

                if (javaError) {
                    addFinding(findings, 'error', 'java-unavailable', `Java is required for jar launcher: ${javaError}`);
                } else {
                    addFinding(findings, 'info', 'java-ready', 'Java runtime is available for jar launcher.');
                }
            }

            if (normalizedJvmArgs && entrypoint.kind !== 'jar') {
                addFinding(findings, 'warning', 'jvm-args-ignored', `JVM arguments are ignored for launcher type: ${entrypoint.kind}`);
            }

            try {
                const command = buildManagedServerCommand({
                    entrypoint,
                    javaPath,
                    jvmArgs: normalizedJvmArgs || ''
                });

                commandPreview = formatCommandPreview(command.command, command.args);
                addFinding(findings, 'info', 'command-preview', `Launch command: ${commandPreview}`);
            } catch (error) {
                addFinding(findings, 'error', 'command-build-failed', error instanceof Error ? error.message : String(error));
            }
        }

        const eulaState = readEulaState(normalizedTargetDir);

        if (acceptEula) {
            addFinding(findings, 'info', 'eula-auto-accept', 'Utility will write eula=true before launch.');
        } else if (eulaState !== 'accepted') {
            addFinding(findings, 'warning', 'eula-pending', 'EULA is not accepted yet; first launch may stop until eula=true is written.');
        }
    }

    return {
        ok: !findings.some((finding) => finding.level === 'error'),
        mode,
        coreType,
        targetDir: normalizedTargetDir,
        entrypoint,
        commandPreview,
        findings
    };
}

const preflightApi = {
    runServerPreflight
};

export default preflightApi;
