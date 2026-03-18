import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import type { ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';

import type { ManagedServerCommand, ManagedServerEntrypoint } from './types.js';

function parseCommandLineArgs(value: string): string[] {
    const matches = String(value || '').match(/"([^"]*)"|'([^']*)'|`([^`]*)`|(\S+)/g);

    if (!matches) {
        return [];
    }

    return matches.map((segment) => {
        if ((segment.startsWith('"') && segment.endsWith('"')) || (segment.startsWith('\'') && segment.endsWith('\''))) {
            return segment.slice(1, -1);
        }

        if (segment.startsWith('`') && segment.endsWith('`')) {
            return segment.slice(1, -1);
        }

        return segment;
    });
}

export function buildManagedServerCommand({
    entrypoint,
    javaPath = null,
    jvmArgs = ''
}: {
    entrypoint: ManagedServerEntrypoint;
    javaPath?: string | null;
    jvmArgs?: string;
}): ManagedServerCommand {
    const javaExecutable = javaPath && String(javaPath).trim() ? String(javaPath).trim() : 'java';
    const parsedJvmArgs = parseCommandLineArgs(jvmArgs);

    switch (entrypoint.kind) {
        case 'jar':
            return {
                command: javaExecutable,
                args: [...parsedJvmArgs, '-jar', path.basename(entrypoint.path), 'nogui']
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
        case 'node-script':
            return {
                command: process.execPath,
                args: [path.basename(entrypoint.path)]
            };
        case 'shell-script':
            return {
                command: 'bash',
                args: [path.basename(entrypoint.path)]
            };
        case 'executable':
            return {
                command: entrypoint.path,
                args: []
            };
        default:
            throw new Error(`Unsupported server entrypoint kind: ${entrypoint.kind}`);
    }
}

export function ensureServerEulaAccepted(serverDir: string): string {
    const eulaPath = path.join(serverDir, 'eula.txt');
    fs.writeFileSync(eulaPath, 'eula=true\n', 'utf8');
    return eulaPath;
}

export function startManagedServerProcess({
    entrypoint,
    serverDir,
    javaPath = null,
    jvmArgs = ''
}: {
    entrypoint: ManagedServerEntrypoint;
    serverDir: string;
    javaPath?: string | null;
    jvmArgs?: string;
}): ChildProcessByStdio<null, Readable, Readable> {
    const command = buildManagedServerCommand({
        entrypoint,
        javaPath,
        jvmArgs
    });

    return spawn(command.command, command.args, {
        cwd: serverDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
    });
}

const runtimeApi = {
    buildManagedServerCommand,
    ensureServerEulaAccepted,
    startManagedServerProcess
};

export default runtimeApi;
