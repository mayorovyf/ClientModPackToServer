const fs = require('node:fs');
const path = require('node:path');

const { FileCopyError, OutputDirectoryError, ResultCollisionError } = require('../core/errors');
const { ensureDirectory } = require('../io/history');
const { copyDirectoryRecursive } = require('./file-transfer');
const { loadWorkspaceManifest, saveWorkspaceManifest } = require('./workspace-manifest');

import type { RunContext } from '../types/run';
import type { WorkspaceManifest } from '../types/workspace';

const INSTANCE_COPY_EXCLUDED_NAMES = new Set([
    'mods',
    'resourcepacks',
    'shaderpacks',
    'screenshots',
    'saves',
    'logs',
    'crash-reports',
    'downloads',
    'build',
    'reports',
    'tmp',
    'cache'
]);

const INSTANCE_COPY_EXCLUDED_FILE_NAMES = new Set([
    'options.txt',
    'optionsof.txt',
    'optionsshaders.txt',
    'options.amecsapi.txt',
    'servers.dat',
    'servers.dat_old',
    'realms_persistence.json',
    'launcher_profiles.json',
    'launcher_accounts.json',
    'usercache.json',
    'usernamecache.json'
]);

export interface WorkspaceSessionHandle {
    runContext: RunContext;
    manifest: WorkspaceManifest;
    initialized: boolean;
    baseWorkspaceReady: boolean;
}

function isSamePath(leftPath: string, rightPath: string): boolean {
    return path.resolve(leftPath) === path.resolve(rightPath);
}

function shouldSkipInstanceEntry(sourcePath: string, entryName: string, runContext: RunContext): boolean {
    if (INSTANCE_COPY_EXCLUDED_NAMES.has(entryName.toLowerCase())) {
        return true;
    }

    if (INSTANCE_COPY_EXCLUDED_FILE_NAMES.has(entryName.toLowerCase())) {
        return true;
    }

    return isSamePath(sourcePath, runContext.outputRootDir)
        || isSamePath(sourcePath, runContext.reportRootDir)
        || isSamePath(sourcePath, runContext.tmpRootDir);
}

function createWorkspaceSession(runContext: RunContext): WorkspaceSessionHandle {
    return {
        runContext,
        manifest: loadWorkspaceManifest(runContext),
        initialized: false,
        baseWorkspaceReady: false
    };
}

function shouldResetWorkspaceForRun(session: WorkspaceSessionHandle): boolean {
    const { manifest, runContext } = session;

    if (!fs.existsSync(runContext.buildDir)) {
        return false;
    }

    if (!fs.existsSync(runContext.workspaceManifestPath)) {
        return false;
    }

    return manifest.runId !== runContext.runId
        || path.resolve(manifest.inputPath) !== path.resolve(runContext.inputPath)
        || path.resolve(manifest.instancePath) !== path.resolve(runContext.instancePath)
        || path.resolve(manifest.modsPath) !== path.resolve(runContext.modsPath);
}

function resetWorkspaceForRun({
    session,
    record
}: {
    session: WorkspaceSessionHandle;
    record: (level: string, kind: string, message: string) => void;
}): void {
    if (!shouldResetWorkspaceForRun(session)) {
        return;
    }

    record(
        'info',
        'build',
        `Resetting managed workspace for a new run: ${session.runContext.buildDir}`
    );
    fs.rmSync(session.runContext.buildDir, { recursive: true, force: true });
    session.manifest = loadWorkspaceManifest(session.runContext);
    session.initialized = false;
    session.baseWorkspaceReady = false;
}

function ensureWorkspaceRoots(session: WorkspaceSessionHandle): void {
    const { runContext } = session;

    try {
        ensureDirectory(runContext.outputRootDir);

        if (!fs.existsSync(runContext.buildDir)) {
            ensureDirectory(runContext.buildDir);
        } else if (!fs.existsSync(runContext.workspaceManifestPath) && fs.readdirSync(runContext.buildDir).length > 0) {
            throw new ResultCollisionError(`Output directory already exists and is not managed by the current workspace session: ${runContext.buildDir}`);
        }

        ensureDirectory(runContext.buildModsDir);
        ensureDirectory(runContext.buildInternalDir);
        ensureDirectory(runContext.workspaceStashDir);
        ensureDirectory(runContext.workspaceStashModsDir);
        ensureDirectory(runContext.workspaceCoreCacheDir);
        ensureDirectory(runContext.validationSandboxRootDir);
    } catch (error) {
        if (error instanceof ResultCollisionError) {
            throw error;
        }

        throw new OutputDirectoryError(`Failed to prepare workspace directory: ${runContext.buildDir}`, { cause: error });
    }
}

function copyInstanceSkeleton(runContext: RunContext, record: (level: string, kind: string, message: string) => void): number {
    if (isSamePath(runContext.instancePath, runContext.modsPath)) {
        record('info', 'build', 'Skipping instance skeleton copy because input points directly to mods/');
        return 0;
    }

    const entries = fs.readdirSync(runContext.instancePath, { withFileTypes: true });
    let copiedEntries = 0;

    for (const entry of entries) {
        const sourcePath = path.join(runContext.instancePath, entry.name);

        if (shouldSkipInstanceEntry(sourcePath, entry.name, runContext)) {
            continue;
        }

        const destinationPath = path.join(runContext.buildDir, entry.name);

        try {
            copyDirectoryRecursive(sourcePath, destinationPath);
            copiedEntries += 1;
            record('info', 'build', `Copied instance entry: ${entry.name}`);
        } catch (error) {
            throw new FileCopyError(`Failed to copy instance entry: ${entry.name}`, { cause: error });
        }
    }

    return copiedEntries;
}

function initializeBaseWorkspace({
    session,
    record = () => {}
}: {
    session: WorkspaceSessionHandle;
    record?: (level: string, kind: string, message: string) => void;
}): { skeletonEntriesCopied: number } {
    if (session.runContext.dryRun) {
        session.initialized = true;
        session.baseWorkspaceReady = true;
        return {
            skeletonEntriesCopied: 0
        };
    }

    resetWorkspaceForRun({
        session,
        record
    });
    ensureWorkspaceRoots(session);
    let skeletonEntriesCopied = 0;

    if (!session.manifest.instanceSkeletonCopied) {
        skeletonEntriesCopied = copyInstanceSkeleton(session.runContext, record);
        session.manifest = saveWorkspaceManifest(session.runContext, {
            ...session.manifest,
            instanceSkeletonCopied: true
        });
    }

    session.initialized = true;
    session.baseWorkspaceReady = true;

    return {
        skeletonEntriesCopied
    };
}

function updateWorkspaceManifest(session: WorkspaceSessionHandle, patch: Partial<WorkspaceManifest>): WorkspaceManifest {
    session.manifest = saveWorkspaceManifest(session.runContext, {
        ...session.manifest,
        ...patch
    });
    return session.manifest;
}

module.exports = {
    createWorkspaceSession,
    initializeBaseWorkspace,
    updateWorkspaceManifest
};
