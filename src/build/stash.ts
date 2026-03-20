const fs = require('node:fs');
const path = require('node:path');

const { ensureDirectory } = require('../io/history');
const { moveOrCopyFile } = require('./file-transfer');

import type { RunContext } from '../types/run';

function getStashedModPath(runContext: RunContext, fileName: string): string {
    return path.join(runContext.workspaceStashModsDir, fileName);
}

function ensureStashDirectories(runContext: RunContext): void {
    ensureDirectory(runContext.workspaceStashDir);
    ensureDirectory(runContext.workspaceStashModsDir);
}

function stashWorkspaceMod({
    runContext,
    fileName
}: {
    runContext: RunContext;
    fileName: string;
}): boolean {
    const sourcePath = path.join(runContext.buildModsDir, fileName);

    if (!fs.existsSync(sourcePath)) {
        return false;
    }

    ensureStashDirectories(runContext);
    moveOrCopyFile(sourcePath, getStashedModPath(runContext, fileName));
    return true;
}

function restoreWorkspaceMod({
    runContext,
    fileName
}: {
    runContext: RunContext;
    fileName: string;
}): string | null {
    const stashedPath = getStashedModPath(runContext, fileName);

    if (!fs.existsSync(stashedPath)) {
        return null;
    }

    ensureDirectory(runContext.buildModsDir);
    moveOrCopyFile(stashedPath, path.join(runContext.buildModsDir, fileName));
    return 'stash';
}

module.exports = {
    ensureStashDirectories,
    getStashedModPath,
    restoreWorkspaceMod,
    stashWorkspaceMod
};
