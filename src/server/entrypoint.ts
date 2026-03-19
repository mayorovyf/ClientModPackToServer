import fs from 'node:fs';
import path from 'node:path';

import type { ManagedServerEntrypoint, ManagedServerEntrypointKind } from './types.js';

const MAX_AUTO_SCAN_DEPTH = 2;
const IGNORED_AUTO_SCAN_DIRECTORIES = new Set([
    'world',
    'world_nether',
    'world_the_end',
    'logs',
    'mods',
    'config',
    'defaultconfigs',
    'kubejs',
    'libraries',
    'crash-reports',
    'resourcepacks',
    'datapacks',
    'cache',
    'backups'
]);

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

function shouldScanDirectory(entryName: string): boolean {
    return !IGNORED_AUTO_SCAN_DIRECTORIES.has(entryName.toLowerCase());
}

function compareCandidates(
    left: { path: string; priority: number },
    right: { path: string; priority: number }
): number {
    return left.priority - right.priority || left.path.localeCompare(right.path);
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

    if (!serverDir || !fs.existsSync(serverDir)) {
        return null;
    }

    const queue: Array<{ directory: string; depth: number }> = [{ directory: serverDir, depth: 0 }];
    let bestCandidate: { path: string; kind: ManagedServerEntrypointKind; priority: number } | null = null;

    while (queue.length > 0) {
        const current = queue.shift();

        if (!current) {
            continue;
        }

        const entries = fs.readdirSync(current.directory, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(current.directory, entry.name);

            if (entry.isDirectory()) {
                if (current.depth < MAX_AUTO_SCAN_DEPTH && shouldScanDirectory(entry.name)) {
                    queue.push({ directory: fullPath, depth: current.depth + 1 });
                }

                continue;
            }

            const kind = getManagedServerEntrypointKind(fullPath);
            const priority = kind ? getCandidatePriority(fullPath) : null;

            if (!kind || priority === null) {
                continue;
            }

            const candidate = { path: fullPath, kind, priority };

            if (!bestCandidate || compareCandidates(candidate, bestCandidate) < 0) {
                bestCandidate = candidate;

                if (priority === 10) {
                    break;
                }
            }
        }

        if (bestCandidate?.priority === 10) {
            break;
        }
    }

    if (!bestCandidate) {
        return null;
    }

    return {
        path: bestCandidate.path,
        originalPath: bestCandidate.path,
        source: 'auto',
        kind: bestCandidate.kind
    };
}

const entrypointApi = {
    getManagedServerEntrypointKind,
    resolveManagedServerEntrypoint
};

export default entrypointApi;
