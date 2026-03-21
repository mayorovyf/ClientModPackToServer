const fs = require('node:fs');
const path = require('node:path');

const { finalizeDecision } = require('./decision-model');
const { ensureDirectory } = require('../io/history');
const { linkOrCopyFile, removePathIfExists } = require('./file-transfer');
const { restoreWorkspaceMod, stashWorkspaceMod } = require('./stash');
const { updateWorkspaceManifest } = require('./workspace-session');

import type { RunContext } from '../types/run';
import type { CandidateDelta, WorkspaceMaterializationStats } from '../types/workspace';
import type { WorkspaceSessionHandle } from './workspace-session';
import type { BuildProgressReporter } from '../types/app';

interface DecisionLike {
    fileName: string;
    sourcePath: string;
    decision?: 'keep' | 'exclude';
    topologyPartition?: string | null;
    topologyReason?: string | null;
    reason?: string;
    decisionOrigin?: string | null;
    actionStatus?: string | null;
    destinationPath?: string | null;
    error?: {
        code?: string | null;
        message?: string | null;
    } | null;
}

function toSortedUnique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function shouldKeepDecision(decision: DecisionLike): boolean {
    return decision.decision !== 'exclude' && decision.topologyPartition !== 'topology-incompatible-artifact';
}

function createEmptyStats(validationOnly = false): WorkspaceMaterializationStats {
    return {
        copied: 0,
        linked: 0,
        reused: 0,
        restoredFromStash: 0,
        movedToStash: 0,
        removedStale: 0,
        skeletonEntriesCopied: 0,
        validationOnly
    };
}

function createCandidateDelta({
    decisions,
    session,
    acceptEula = false
}: {
    decisions: DecisionLike[];
    session: WorkspaceSessionHandle;
    acceptEula?: boolean;
}): CandidateDelta {
    const desiredKeepFiles = toSortedUnique(
        decisions.filter((decision) => shouldKeepDecision(decision)).map((decision) => decision.fileName)
    );
    const desiredExcludeFiles = toSortedUnique(
        decisions.filter((decision) => !shouldKeepDecision(decision)).map((decision) => decision.fileName)
    );
    const activeMods = new Set(session.manifest.activeMods);
    const stashedMods = new Set(session.manifest.stashedMods);
    const desiredKeepSet = new Set(desiredKeepFiles);
    const modsToReuse = desiredKeepFiles.filter((fileName) => activeMods.has(fileName));
    const modsToRestoreFromStash = desiredKeepFiles.filter((fileName) => !activeMods.has(fileName) && stashedMods.has(fileName));
    const modsToAdd = desiredKeepFiles.filter((fileName) => !activeMods.has(fileName) && !stashedMods.has(fileName));
    const modsToStash = session.manifest.activeMods.filter((fileName) => !desiredKeepSet.has(fileName));

    return {
        desiredKeepFiles,
        desiredExcludeFiles,
        modsToAdd,
        modsToReuse,
        modsToRestoreFromStash,
        modsToStash,
        eulaAccepted: acceptEula,
        validationOnly: modsToAdd.length === 0
            && modsToRestoreFromStash.length === 0
            && modsToStash.length === 0
            && !acceptEula
    };
}

function removeUnexpectedWorkspaceMods({
    runContext,
    delta
}: {
    runContext: RunContext;
    delta: CandidateDelta;
}): number {
    if (!fs.existsSync(runContext.buildModsDir)) {
        return 0;
    }

    const desiredKeepSet = new Set(delta.desiredKeepFiles);
    let removed = 0;

    for (const entry of fs.readdirSync(runContext.buildModsDir, { withFileTypes: true })) {
        if (!entry.isFile()) {
            continue;
        }

        if (desiredKeepSet.has(entry.name)) {
            continue;
        }

        removePathIfExists(path.join(runContext.buildModsDir, entry.name));
        removed += 1;
    }

    return removed;
}

function buildDecisionError(message: string) {
    return {
        code: 'WORKSPACE_MATERIALIZATION_ERROR',
        message
    };
}

function applyWorkspaceDelta({
    decisions,
    runContext,
    session,
    delta,
    skeletonEntriesCopied = 0,
    record = () => {},
    progressReporter = null
}: {
    decisions: DecisionLike[];
    runContext: RunContext;
    session: WorkspaceSessionHandle;
    delta: CandidateDelta;
    skeletonEntriesCopied?: number;
    record?: (level: string, kind: string, message: string) => void;
    progressReporter?: BuildProgressReporter | null;
}): {
    decisions: Array<Record<string, any>>;
    stats: WorkspaceMaterializationStats;
    delta: CandidateDelta;
} {
    const stats = createEmptyStats(delta.validationOnly);
    stats.skeletonEntriesCopied = skeletonEntriesCopied;
    const total = decisions.length;

    if (runContext.dryRun) {
        const finalized = decisions.map((decision, index) => {
            progressReporter?.onStageActivity({
                stage: 'build',
                activityType: shouldKeepDecision(decision) ? 'build-would-copy' : 'build-would-exclude',
                message: `${shouldKeepDecision(decision) ? 'Would copy' : 'Would exclude'} ${decision.fileName} (${index + 1}/${total})`,
                fileName: decision.fileName,
                index: index + 1,
                total,
                decision: shouldKeepDecision(decision) ? 'keep' : 'exclude'
            });
            const finalizedDecision = finalizeDecision(decision, shouldKeepDecision(decision)
                ? {
                    actionStatus: 'would-copy',
                    destinationPath: path.join(runContext.buildModsDir, decision.fileName)
                }
                : {
                    actionStatus: 'would-exclude'
                });

            progressReporter?.onBuildActionCompleted({
                fileName: decision.fileName,
                ...finalizedDecision,
                index: index + 1,
                total
            });

            return finalizedDecision;
        });

        return {
            decisions: finalized,
            stats,
            delta
        };
    }

    ensureDirectory(runContext.buildModsDir);
    stats.removedStale = removeUnexpectedWorkspaceMods({
        runContext,
        delta
    });

    for (const fileName of delta.modsToStash) {
        if (stashWorkspaceMod({ runContext, fileName })) {
            stats.movedToStash += 1;
            record('info', 'build', `Stashed: ${fileName}`);
        }
    }

    const desiredKeepSet = new Set(delta.desiredKeepFiles);
    const nextStashedMods = toSortedUnique([
        ...session.manifest.stashedMods.filter((fileName) => !desiredKeepSet.has(fileName)),
        ...delta.modsToStash
    ]);
    const finalizedDecisions = decisions.map((decision, index) => {
        const destinationPath = path.join(runContext.buildModsDir, decision.fileName);
        let finalizedDecision: Record<string, any>;

        if (!shouldKeepDecision(decision)) {
            progressReporter?.onStageActivity({
                stage: 'build',
                activityType: 'build-exclude',
                message: `Excluding ${decision.fileName} (${index + 1}/${total})`,
                fileName: decision.fileName,
                index: index + 1,
                total,
                decision: 'exclude'
            });
            record('info', 'build', `Excluded: ${decision.fileName}`);
            finalizedDecision = finalizeDecision(decision, {
                decision: 'exclude',
                reason: decision.topologyPartition === 'topology-incompatible-artifact'
                    ? (decision.topologyReason || decision.reason)
                    : decision.reason,
                decisionOrigin: decision.topologyPartition === 'topology-incompatible-artifact'
                    ? (decision.decisionOrigin || 'runtime-topology')
                    : decision.decisionOrigin,
                actionStatus: 'excluded',
                destinationPath: null
            });
            progressReporter?.onBuildActionCompleted({
                fileName: decision.fileName,
                ...finalizedDecision,
                index: index + 1,
                total
            });
            return finalizedDecision;
        }

        if (delta.modsToReuse.includes(decision.fileName) && fs.existsSync(destinationPath)) {
            progressReporter?.onStageActivity({
                stage: 'build',
                activityType: 'build-reuse',
                message: `Reusing ${decision.fileName} (${index + 1}/${total})`,
                fileName: decision.fileName,
                index: index + 1,
                total,
                decision: 'keep'
            });
            stats.reused += 1;
            record('info', 'build', `Reused: ${decision.fileName}`);
            finalizedDecision = finalizeDecision(decision, {
                actionStatus: 'reused',
                destinationPath
            });
            progressReporter?.onBuildActionCompleted({
                fileName: decision.fileName,
                ...finalizedDecision,
                index: index + 1,
                total
            });
            return finalizedDecision;
        }

        if (delta.modsToRestoreFromStash.includes(decision.fileName)) {
            progressReporter?.onStageActivity({
                stage: 'build',
                activityType: 'build-restore',
                message: `Restoring ${decision.fileName} from stash (${index + 1}/${total})`,
                fileName: decision.fileName,
                index: index + 1,
                total,
                decision: 'keep'
            });
            try {
                restoreWorkspaceMod({
                    runContext,
                    fileName: decision.fileName
                });
                stats.restoredFromStash += 1;
                record('success', 'build', `Restored from stash: ${decision.fileName}`);
                finalizedDecision = finalizeDecision(decision, {
                    actionStatus: 'restored',
                    destinationPath
                });
                progressReporter?.onBuildActionCompleted({
                    fileName: decision.fileName,
                    ...finalizedDecision,
                    index: index + 1,
                    total
                });
                return finalizedDecision;
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                record('error', 'build', message);
                finalizedDecision = finalizeDecision(decision, {
                    actionStatus: 'error',
                    destinationPath,
                    error: buildDecisionError(message)
                });
                progressReporter?.onBuildActionCompleted({
                    fileName: decision.fileName,
                    ...finalizedDecision,
                    index: index + 1,
                    total
                });
                return finalizedDecision;
            }
        }

        try {
            progressReporter?.onStageActivity({
                stage: 'build',
                activityType: 'build-copy',
                message: `Copying ${decision.fileName} (${index + 1}/${total})`,
                fileName: decision.fileName,
                index: index + 1,
                total,
                decision: 'keep'
            });
            const transferMode = linkOrCopyFile(decision.sourcePath, destinationPath);

            if (transferMode === 'linked') {
                stats.linked += 1;
                record('success', 'build', `Linked: ${decision.fileName}`);
                finalizedDecision = finalizeDecision(decision, {
                    actionStatus: 'copied',
                    destinationPath
                });
                progressReporter?.onBuildActionCompleted({
                    fileName: decision.fileName,
                    ...finalizedDecision,
                    index: index + 1,
                    total
                });
                return finalizedDecision;
            }

            stats.copied += 1;
            record('success', 'build', `Copied: ${decision.fileName}`);
            finalizedDecision = finalizeDecision(decision, {
                actionStatus: 'copied',
                destinationPath
            });
            progressReporter?.onBuildActionCompleted({
                fileName: decision.fileName,
                ...finalizedDecision,
                index: index + 1,
                total
            });
            return finalizedDecision;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            record('error', 'build', message);
            finalizedDecision = finalizeDecision(decision, {
                actionStatus: 'error',
                destinationPath,
                error: buildDecisionError(message)
            });
            progressReporter?.onBuildActionCompleted({
                fileName: decision.fileName,
                ...finalizedDecision,
                index: index + 1,
                total
            });
            return finalizedDecision;
        }
    });

    updateWorkspaceManifest(session, {
        activeMods: delta.desiredKeepFiles,
        stashedMods: nextStashedMods
    });

    return {
        decisions: finalizedDecisions,
        stats,
        delta
    };
}

module.exports = {
    applyWorkspaceDelta,
    createCandidateDelta
};
