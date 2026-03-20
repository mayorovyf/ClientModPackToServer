const fs = require('node:fs');
const path = require('node:path');

const { ensureDirectory } = require('../io/history');

import type { ValidationSandboxStats } from '../types/workspace';

function ensureParentDirectory(filePath: string): void {
    ensureDirectory(path.dirname(filePath));
}

function removePathIfExists(targetPath: string): void {
    if (!fs.existsSync(targetPath)) {
        return;
    }

    fs.rmSync(targetPath, { recursive: true, force: true });
}

function linkOrCopyFile(sourcePath: string, destinationPath: string): 'linked' | 'copied' {
    ensureParentDirectory(destinationPath);
    removePathIfExists(destinationPath);

    try {
        fs.linkSync(sourcePath, destinationPath);
        return 'linked';
    } catch {
        fs.copyFileSync(sourcePath, destinationPath);
        return 'copied';
    }
}

function moveOrCopyFile(sourcePath: string, destinationPath: string): 'moved' | 'copied' {
    ensureParentDirectory(destinationPath);
    removePathIfExists(destinationPath);

    try {
        fs.renameSync(sourcePath, destinationPath);
        return 'moved';
    } catch {
        fs.copyFileSync(sourcePath, destinationPath);
        fs.rmSync(sourcePath, { force: true });
        return 'copied';
    }
}

function copyDirectoryRecursive(sourcePath: string, destinationPath: string): void {
    removePathIfExists(destinationPath);
    const stat = fs.statSync(sourcePath);

    if (stat.isDirectory()) {
        fs.cpSync(sourcePath, destinationPath, {
            recursive: true,
            force: true
        });
        return;
    }

    ensureParentDirectory(destinationPath);
    fs.copyFileSync(sourcePath, destinationPath);
}

function isMutableSandboxPath(relativePath: string): boolean {
    const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
    const topLevel = normalized.split('/')[0] || normalized;

    if (
        topLevel === 'config'
        || topLevel === 'defaultconfigs'
        || topLevel === 'logs'
        || topLevel === 'world'
        || topLevel === 'crash-reports'
        || topLevel === 'serverconfig'
    ) {
        return true;
    }

    return normalized === 'eula.txt'
        || normalized === 'server.properties'
        || normalized === 'usercache.json'
        || normalized === 'ops.json'
        || normalized === 'whitelist.json'
        || normalized === 'banned-players.json'
        || normalized === 'banned-ips.json';
}

function shouldSkipValidationSandboxPath(relativePath: string): boolean {
    const normalized = relativePath.replace(/\\/g, '/').toLowerCase();

    return normalized === '.cmpts/workspace-manifest.json'
        || normalized === '.cmpts/core-cache'
        || normalized.startsWith('.cmpts/core-cache/')
        || normalized === '.cmpts/stash'
        || normalized.startsWith('.cmpts/stash/');
}

function cloneWorkspaceTreeForValidation({
    sourceDir,
    destinationDir
}: {
    sourceDir: string;
    destinationDir: string;
}): ValidationSandboxStats {
    const stats: ValidationSandboxStats = {
        linkedFiles: 0,
        copiedFiles: 0,
        copiedDirectories: 0
    };

    removePathIfExists(destinationDir);
    ensureDirectory(destinationDir);
    const queue: Array<{ sourcePath: string; relativePath: string }> = [{ sourcePath: sourceDir, relativePath: '' }];

    while (queue.length > 0) {
        const current = queue.shift();

        if (!current) {
            continue;
        }

        const entries = fs.readdirSync(current.sourcePath, { withFileTypes: true });

        for (const entry of entries) {
            const sourcePath = path.join(current.sourcePath, entry.name);
            const relativePath = current.relativePath ? path.join(current.relativePath, entry.name) : entry.name;
            const destinationPath = path.join(destinationDir, relativePath);

            if (shouldSkipValidationSandboxPath(relativePath)) {
                continue;
            }

            if (entry.isDirectory()) {
                if (isMutableSandboxPath(relativePath)) {
                    copyDirectoryRecursive(sourcePath, destinationPath);
                    stats.copiedDirectories += 1;
                    continue;
                }

                ensureDirectory(destinationPath);
                queue.push({
                    sourcePath,
                    relativePath
                });
                continue;
            }

            const transferMode = isMutableSandboxPath(relativePath)
                ? (copyDirectoryRecursive(sourcePath, destinationPath), 'copied')
                : linkOrCopyFile(sourcePath, destinationPath);

            if (transferMode === 'linked') {
                stats.linkedFiles += 1;
            } else {
                stats.copiedFiles += 1;
            }
        }
    }

    return stats;
}

module.exports = {
    cloneWorkspaceTreeForValidation,
    copyDirectoryRecursive,
    ensureParentDirectory,
    linkOrCopyFile,
    moveOrCopyFile,
    removePathIfExists
};
