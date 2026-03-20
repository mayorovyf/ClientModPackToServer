const fs = require('node:fs');
const path = require('node:path');

const { ensureDirectory } = require('../io/history');
const { analyzeProbeRuntime } = require('./analyze-log');
const { materializeExplicitEntrypoint, resolveValidationEntrypoint } = require('../validation/entrypoint-resolver');
const { runValidationProcess } = require('../validation/process-runner');

import type { ModDescriptor } from '../types/descriptor';
import type { ProbeOutcome, ProbePlanStep } from '../types/probe';
import type { RunContext } from '../types/run';

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

function prepareProbeWorkspace(runContext: RunContext): { workspaceRoot: string; workspaceDir: string; modsDir: string } {
    ensureDirectory(runContext.tmpRootDir);
    const workspaceRoot = fs.mkdtempSync(path.join(runContext.tmpRootDir, `${runContext.runId}-probe-`));
    const workspaceDir = path.join(workspaceRoot, 'server');
    const modsDir = path.join(workspaceDir, 'mods');
    fs.mkdirSync(workspaceDir, { recursive: true });

    if (!isSamePath(runContext.instancePath, runContext.modsPath)) {
        const entries = fs.readdirSync(runContext.instancePath, { withFileTypes: true });

        for (const entry of entries) {
            const sourcePath = path.join(runContext.instancePath, entry.name);

            if (shouldSkipInstanceEntry(sourcePath, entry.name, runContext)) {
                continue;
            }

            const destinationPath = path.join(workspaceDir, entry.name);
            fs.cpSync(sourcePath, destinationPath, {
                recursive: true,
                force: false,
                errorOnExist: false
            });
        }
    }

    fs.mkdirSync(modsDir, { recursive: true });
    return {
        workspaceRoot,
        workspaceDir,
        modsDir
    };
}

function cleanupProbeWorkspace(workspaceRoot: string | null): void {
    if (!workspaceRoot || !fs.existsSync(workspaceRoot)) {
        return;
    }

    fs.rmSync(workspaceRoot, { recursive: true, force: true });
}

function writeProbeLog({
    runContext,
    step,
    combinedOutput
}: {
    runContext: RunContext;
    step: ProbePlanStep;
    combinedOutput: string;
}): string | null {
    try {
        const probeLogsDir = path.join(runContext.reportDir, 'probe-logs');
        ensureDirectory(runContext.reportRootDir);
        ensureDirectory(runContext.reportDir);
        ensureDirectory(probeLogsDir);
        const logPath = path.join(probeLogsDir, `${step.fileName.replace(/[^a-z0-9_.-]+/gi, '_')}.log`);
        fs.writeFileSync(logPath, combinedOutput || '', 'utf8');
        return logPath;
    } catch {
        return null;
    }
}

function copyProbeMods(modsDir: string, sourcePaths: string[]): void {
    for (const sourcePath of sourcePaths) {
        const destinationPath = path.join(modsDir, path.basename(sourcePath));

        if (!fs.existsSync(sourcePath) || fs.existsSync(destinationPath)) {
            continue;
        }

        fs.copyFileSync(sourcePath, destinationPath);
    }
}

async function runProbeStep({
    step,
    runContext,
    descriptor,
    currentRoleType = 'unknown',
    supportSourcePaths,
    record = () => {}
}: {
    step: ProbePlanStep;
    runContext: RunContext;
    descriptor: ModDescriptor;
    currentRoleType?: ProbeOutcome['roleType'];
    supportSourcePaths: string[];
    record?: (level: string, kind: string, message: string) => void;
}): Promise<ProbeOutcome> {
    let workspaceRoot: string | null = null;

    try {
        const workspace = prepareProbeWorkspace(runContext);
        workspaceRoot = workspace.workspaceRoot;
        copyProbeMods(workspace.modsDir, [step.sourcePath, ...supportSourcePaths]);

        const explicitEntrypoint = materializeExplicitEntrypoint({
            buildDir: workspace.workspaceDir,
            workspaceDir: workspace.workspaceDir,
            explicitPath: runContext.validationEntrypointPath
        });
        const entrypoint = resolveValidationEntrypoint({
            workspaceDir: workspace.workspaceDir,
            explicitEntrypoint
        });

        if (!entrypoint) {
            return {
                fileName: step.fileName,
                sourcePath: step.sourcePath,
                requiredSupportFiles: step.requiredSupportFiles,
                outcome: 'inconclusive',
                semanticDecision: 'unknown',
                roleType: currentRoleType,
                confidence: 'low',
                reason: 'Probe entrypoint was not found in the workspace or via explicit validation launcher',
                evidence: [],
                durationMs: 0,
                timedOut: false,
                knowledgeApplied: false,
                logPath: null
            };
        }

        record('info', 'probe', `Probing ${step.fileName} with ${supportSourcePaths.length} support jar(s)`);
        const processRuntime = await runValidationProcess({
            entrypoint,
            workingDirectory: workspace.workspaceDir,
            timeoutMs: runContext.probeTimeoutMs,
            record
        });
        const logPath = writeProbeLog({
            runContext,
            step,
            combinedOutput: processRuntime.combinedOutput
        });
        const outcome = analyzeProbeRuntime({
            fileName: step.fileName,
            sourcePath: step.sourcePath,
            requiredSupportFiles: step.requiredSupportFiles,
            descriptor,
            currentRoleType,
            processRuntime
        });

        return {
            ...outcome,
            logPath
        };
    } finally {
        cleanupProbeWorkspace(workspaceRoot);
    }
}

module.exports = {
    runProbeStep
};
