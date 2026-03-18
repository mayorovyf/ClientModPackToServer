const fs = require('node:fs');
const path = require('node:path');

import type { ValidationEntrypoint, ValidationEntrypointKind } from '../types/validation';

function walkFiles(rootDirectory: string): string[] {
    if (!fs.existsSync(rootDirectory)) {
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

function getEntrypointKind(filePath: string): ValidationEntrypointKind | null {
    const extension = path.extname(filePath).toLowerCase();

    switch (extension) {
        case '.jar':
            return 'jar';
        case '.js':
        case '.cjs':
        case '.mjs':
            return 'node-script';
        case '.cmd':
        case '.bat':
            return 'cmd-script';
        case '.ps1':
            return 'powershell-script';
        case '.exe':
            return 'executable';
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
        return 20;
    }

    if (/^neoforge.*\.jar$/.test(baseName)) {
        return 30;
    }

    if (/^forge.*\.jar$/.test(baseName)) {
        return 40;
    }

    if ((baseName.includes('server') || baseName.includes('launch')) && getEntrypointKind(filePath)) {
        return 60;
    }

    return null;
}

function materializeExplicitEntrypoint({
    buildDir,
    workspaceDir,
    explicitPath
}: {
    buildDir: string;
    workspaceDir: string;
    explicitPath: string | null | undefined;
}): ValidationEntrypoint | null {
    if (!explicitPath) {
        return null;
    }

    const resolvedPath = path.resolve(explicitPath);

    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Validation entrypoint does not exist: ${resolvedPath}`);
    }

    const normalizedBuildDir = path.resolve(buildDir);
    const normalizedWorkspaceDir = path.resolve(workspaceDir);

    if (resolvedPath.startsWith(`${normalizedBuildDir}${path.sep}`)) {
        const relativePath = path.relative(normalizedBuildDir, resolvedPath);
        const workspacePath = path.join(normalizedWorkspaceDir, relativePath);
        const kind = getEntrypointKind(workspacePath);

        if (!fs.existsSync(workspacePath)) {
            throw new Error(`Validation entrypoint is missing in workspace copy: ${workspacePath}`);
        }

        if (!kind) {
            throw new Error(`Unsupported validation entrypoint type: ${workspacePath}`);
        }

        return {
            path: workspacePath,
            originalPath: resolvedPath,
            source: 'explicit',
            kind
        };
    }

    const targetPath = path.join(normalizedWorkspaceDir, path.basename(resolvedPath));
    const targetKind = getEntrypointKind(targetPath);

    if (!targetKind) {
        throw new Error(`Unsupported validation entrypoint type: ${targetPath}`);
    }

    fs.copyFileSync(resolvedPath, targetPath);

    return {
        path: targetPath,
        originalPath: resolvedPath,
        source: 'explicit',
        kind: targetKind
    };
}

function resolveValidationEntrypoint({
    workspaceDir,
    explicitEntrypoint = null
}: {
    workspaceDir: string;
    explicitEntrypoint?: ValidationEntrypoint | null;
}): ValidationEntrypoint | null {
    if (explicitEntrypoint) {
        if (!explicitEntrypoint.kind) {
            throw new Error(`Unsupported validation entrypoint type: ${explicitEntrypoint.path}`);
        }

        return explicitEntrypoint;
    }

    const candidates = walkFiles(workspaceDir)
        .map((filePath) => ({
            path: filePath,
            source: 'auto' as const,
            kind: getEntrypointKind(filePath),
            priority: getCandidatePriority(filePath)
        }))
        .filter((candidate) => candidate.kind && candidate.priority !== null)
        .sort((left, right) => (left.priority as number) - (right.priority as number) || left.path.localeCompare(right.path));

    if (candidates.length === 0) {
        return null;
    }

    const bestCandidate = candidates[0];

    return {
        path: bestCandidate.path,
        originalPath: bestCandidate.path,
        source: bestCandidate.source,
        kind: bestCandidate.kind as ValidationEntrypointKind
    };
}

module.exports = {
    getEntrypointKind,
    materializeExplicitEntrypoint,
    resolveValidationEntrypoint
};
