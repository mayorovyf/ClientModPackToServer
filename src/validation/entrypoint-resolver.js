const fs = require('fs');
const path = require('path');

function walkFiles(rootDirectory) {
    if (!fs.existsSync(rootDirectory)) {
        return [];
    }

    const queue = [rootDirectory];
    const discovered = [];

    while (queue.length > 0) {
        const currentDirectory = queue.shift();
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

function getEntrypointKind(filePath) {
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

function getCandidatePriority(filePath) {
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

function materializeExplicitEntrypoint({ buildDir, workspaceDir, explicitPath }) {
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

        if (!fs.existsSync(workspacePath)) {
            throw new Error(`Validation entrypoint is missing in workspace copy: ${workspacePath}`);
        }

        return {
            path: workspacePath,
            originalPath: resolvedPath,
            source: 'explicit',
            kind: getEntrypointKind(workspacePath)
        };
    }

    const targetPath = path.join(normalizedWorkspaceDir, path.basename(resolvedPath));
    fs.copyFileSync(resolvedPath, targetPath);

    return {
        path: targetPath,
        originalPath: resolvedPath,
        source: 'explicit',
        kind: getEntrypointKind(targetPath)
    };
}

function resolveValidationEntrypoint({ workspaceDir, explicitEntrypoint = null }) {
    if (explicitEntrypoint) {
        if (!explicitEntrypoint.kind) {
            throw new Error(`Unsupported validation entrypoint type: ${explicitEntrypoint.path}`);
        }

        return explicitEntrypoint;
    }

    const candidates = walkFiles(workspaceDir)
        .map((filePath) => ({
            path: filePath,
            source: 'auto',
            kind: getEntrypointKind(filePath),
            priority: getCandidatePriority(filePath)
        }))
        .filter((candidate) => candidate.kind && candidate.priority !== null)
        .sort((left, right) => left.priority - right.priority || left.path.localeCompare(right.path));

    if (candidates.length === 0) {
        return null;
    }

    const bestCandidate = candidates[0];

    return {
        path: bestCandidate.path,
        originalPath: bestCandidate.path,
        source: bestCandidate.source,
        kind: bestCandidate.kind
    };
}

module.exports = {
    getEntrypointKind,
    materializeExplicitEntrypoint,
    resolveValidationEntrypoint
};
