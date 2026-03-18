import fs from 'node:fs';
import path from 'node:path';

import type { ManagedServerEntrypoint, ManagedServerEntrypointKind } from './types.js';

function walkFiles(rootDirectory: string): string[] {
    if (!rootDirectory || !fs.existsSync(rootDirectory)) {
        return [];
    }

    const queue: string[] = [rootDirectory];
    const discovered: string[] = [];

    while (queue.length > 0) {
        const currentDirectory = queue.shift();

        if (!currentDirectory) {
            continue;
        }

        const entries = fs.readdirSync(currentDirectory, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentDirectory, entry.name);

            if (entry.isDirectory()) {
                queue.push(fullPath);
                continue;
            }

            discovered.push(fullPath);
        }
    }

    return discovered;
}

export function getManagedServerEntrypointKind(filePath: string): ManagedServerEntrypointKind | null {
    const extension = path.extname(filePath).toLowerCase();

    switch (extension) {
        case '.jar':
            return 'jar';
        case '.cmd':
        case '.bat':
            return 'cmd-script';
        case '.ps1':
            return 'powershell-script';
        case '.js':
        case '.cjs':
        case '.mjs':
            return 'node-script';
        case '.exe':
            return 'executable';
        case '.sh':
            return 'shell-script';
        default:
            return null;
    }
}

function getCandidatePriority(filePath: string): number | null {
    const baseName = path.basename(filePath).toLowerCase();

    if (baseName === 'server.jar') {
        return 10;
    }

    if (baseName === 'fabric-server-launch.jar') {
        return 15;
    }

    if (baseName === 'run.bat' || baseName === 'run.cmd' || baseName === 'run.sh') {
        return 20;
    }

    if (/^neoforge.*\.jar$/.test(baseName)) {
        return 30;
    }

    if (/^forge.*\.jar$/.test(baseName)) {
        return 40;
    }

    if ((baseName.includes('server') || baseName.includes('launch') || baseName === 'start.bat' || baseName === 'start.sh')
        && getManagedServerEntrypointKind(filePath)) {
        return 60;
    }

    return null;
}

export function resolveManagedServerEntrypoint({
    serverDir,
    explicitEntrypointPath = null
}: {
    serverDir: string;
    explicitEntrypointPath?: string | null;
}): ManagedServerEntrypoint | null {
    if (explicitEntrypointPath) {
        const resolvedPath = path.resolve(explicitEntrypointPath);

        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`Server entrypoint does not exist: ${resolvedPath}`);
        }

        const kind = getManagedServerEntrypointKind(resolvedPath);

        if (!kind) {
            throw new Error(`Unsupported server entrypoint type: ${resolvedPath}`);
        }

        return {
            path: resolvedPath,
            originalPath: resolvedPath,
            source: 'explicit',
            kind
        };
    }

    const candidates = walkFiles(serverDir)
        .map((filePath) => ({
            path: filePath,
            kind: getManagedServerEntrypointKind(filePath),
            priority: getCandidatePriority(filePath)
        }))
        .filter((candidate) => candidate.kind && candidate.priority !== null)
        .sort((left, right) => (left.priority as number) - (right.priority as number) || left.path.localeCompare(right.path));

    const bestCandidate = candidates[0];

    if (!bestCandidate) {
        return null;
    }

    return {
        path: bestCandidate.path,
        originalPath: bestCandidate.path,
        source: 'auto',
        kind: bestCandidate.kind as ManagedServerEntrypointKind
    };
}

const entrypointApi = {
    getManagedServerEntrypointKind,
    resolveManagedServerEntrypoint
};

export default entrypointApi;
