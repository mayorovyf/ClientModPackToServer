const fs = require('node:fs');
const path = require('node:path');

const { ensureDirectory } = require('../io/history');
const { cloneWorkspaceTreeForValidation, removePathIfExists } = require('../build/file-transfer');

import type { RunContext } from '../types/run';
import type { ValidationSandboxStats } from '../types/workspace';

function createValidationSandbox(runContext: RunContext): {
    workspaceRoot: string;
    workspaceDir: string;
    stats: ValidationSandboxStats;
} {
    ensureDirectory(runContext.validationSandboxRootDir);
    const workspaceRoot = fs.mkdtempSync(path.join(runContext.validationSandboxRootDir, `${runContext.runId}-`));
    const workspaceDir = path.join(workspaceRoot, 'server');
    const stats = cloneWorkspaceTreeForValidation({
        sourceDir: runContext.buildDir,
        destinationDir: workspaceDir
    });

    return {
        workspaceRoot,
        workspaceDir,
        stats
    };
}

function cleanupValidationSandbox(workspaceRoot: string | null): void {
    if (!workspaceRoot) {
        return;
    }

    removePathIfExists(workspaceRoot);
}

module.exports = {
    cleanupValidationSandbox,
    createValidationSandbox
};
