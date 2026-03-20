const { buildClassificationStats } = require('../classification/temporary-merge-policy');
const { buildParsingStats } = require('../metadata/parse-mod-file');
const { detectPackRuntime } = require('../runtime/pack-runtime');
const { ensureServerEulaAccepted } = require('../server/runtime');
const { installDetectedServerCore } = require('../server/build-core');
const { createEmptyValidationReport } = require('../validation/report-model');
const { runValidationStage } = require('../validation/run-validation');
const {
    createEventCollector,
    createNoopProgressReporter,
    collectReportIssues,
    buildStats
} = require('../build/builder');
const { createCandidateState } = require('./candidate-state');
const { determineCandidateExecutionImpact } = require('./execution-impact');
const { buildStaticSnapshot, realizeStaticSnapshot } = require('./static-snapshot');
const { createWorkspaceSession, initializeBaseWorkspace, updateWorkspaceManifest } = require('../build/workspace-session');
const { applyWorkspaceDelta, createCandidateDelta } = require('../build/workspace-materializer');

import type { ApplicationLogger, BuildProgressReporter, ClassificationContextLike } from '../types/app';
import type { RunReport } from '../types/report';
import type { RunContext } from '../types/run';
import type { ValidationError, ValidationResult, ValidationStageResult } from '../types/validation';
import type { AppliedFix, CandidateIterationResult } from './types';
import type { BaseStaticSnapshot, RealizedStaticSnapshot } from './static-snapshot';
import type { WorkspaceSessionHandle } from '../build/workspace-session';

interface CandidateIterationMutations {
    forcedExcludes?: string[];
    forcedKeeps?: string[];
    acceptEula?: boolean;
}

interface RunInitialCandidateIterationParams {
    modsPath: string;
    blockList?: string[];
    classificationContext?: ClassificationContextLike | null;
    runContext: RunContext;
    logger?: ApplicationLogger | null;
    progressReporter?: BuildProgressReporter | null;
    candidateId?: string;
    parentCandidateId?: string | null;
    iteration?: number;
    appliedFixes?: AppliedFix[];
    newlyAppliedFixes?: AppliedFix[];
    mutations?: CandidateIterationMutations;
    staticSnapshot?: BaseStaticSnapshot | null;
    realizedSnapshot?: RealizedStaticSnapshot | null;
    workspaceSession?: WorkspaceSessionHandle | null;
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function getErrorCode(error: unknown, fallbackCode: string): string {
    if (error && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string') {
        return (error as { code: string }).code;
    }

    return fallbackCode;
}

function createEmptyValidation(mode: RunContext['validationMode'], error: ValidationError | null = null): ValidationResult {
    return createEmptyValidationReport(mode, {
        status: error ? 'error' : 'skipped',
        skipReason: error ? null : 'Validation stage was not run',
        errors: error ? [error] : []
    });
}

function appendReason(existingReasons: string[] | null | undefined, nextReason: string): string[] {
    return [...new Set([...(existingReasons || []), nextReason])];
}

function applyCandidateDecisionFixes({
    decisions,
    forcedExcludes = [],
    forcedKeeps = [],
    record
}: {
    decisions: Array<Record<string, any>>;
    forcedExcludes?: string[];
    forcedKeeps?: string[];
    record: (level: string, kind: string, message: string) => void;
}): Array<Record<string, any>> {
    const excludeSet = new Set(forcedExcludes);
    const keepSet = new Set(forcedKeeps);

    return decisions.map((decision) => {
        if (decision.manualOverrideAction) {
            return decision;
        }

        if (decision.topologyPartition === 'topology-incompatible-artifact') {
            return {
                ...decision,
                decision: 'exclude',
                reason: decision.topologyReason || decision.reason,
                decisionOrigin: 'runtime-topology',
                finalSemanticDecision: 'remove',
                finalDecisionOrigin: 'runtime-topology',
                finalReasons: appendReason(decision.finalReasons, decision.topologyReason || decision.reason)
            };
        }

        if (keepSet.has(decision.fileName) && decision.decision !== 'keep') {
            const reason = `Convergence fix forced keep for trusted dependency recovery: ${decision.fileName}`;
            record('info', 'analysis', reason);

            return {
                ...decision,
                decision: 'keep',
                reason,
                decisionOrigin: 'convergence-fix',
                finalSemanticDecision: 'keep',
                finalDecisionOrigin: 'convergence-fix',
                finalReasons: appendReason(decision.finalReasons, reason)
            };
        }

        if (excludeSet.has(decision.fileName) && decision.decision !== 'exclude') {
            const reason = `Convergence fix forced exclude for confirmed client-only suspect: ${decision.fileName}`;
            record('info', 'analysis', reason);

            return {
                ...decision,
                decision: 'exclude',
                reason,
                decisionOrigin: 'convergence-fix',
                finalSemanticDecision: 'remove',
                finalDecisionOrigin: 'convergence-fix',
                finalReasons: appendReason(decision.finalReasons, reason)
            };
        }

        return decision;
    });
}

async function runInitialCandidateIteration({
    modsPath,
    blockList = [],
    classificationContext = null,
    runContext,
    logger = null,
    progressReporter = null,
    candidateId = `${runContext.runId}:candidate-0`,
    parentCandidateId = null,
    iteration = 0,
    appliedFixes = [],
    newlyAppliedFixes = [],
    mutations = {},
    staticSnapshot = null,
    realizedSnapshot = null,
    workspaceSession = null
}: RunInitialCandidateIterationParams): Promise<CandidateIterationResult> {
    const effectiveProgressReporter = progressReporter || createNoopProgressReporter();
    const collector = createEventCollector(logger);
    const effectiveMutations = {
        forcedExcludes: Array.isArray(mutations?.forcedExcludes) ? mutations.forcedExcludes : [],
        forcedKeeps: Array.isArray(mutations?.forcedKeeps) ? mutations.forcedKeeps : [],
        acceptEula: Boolean(mutations?.acceptEula)
    };
    const executionImpact = determineCandidateExecutionImpact({
        iteration,
        newlyAppliedFixes
    });

    collector.record('info', 'analysis', `Run mode: ${runContext.mode}`);
    collector.record('info', 'analysis', `Input directory: ${runContext.inputPath}`);
    collector.record('info', 'analysis', `Instance directory: ${runContext.instancePath}`);
    collector.record('info', 'analysis', `Mods directory: ${modsPath}`);
    collector.record('info', 'analysis', `Build root: ${runContext.outputRootDir}`);
    collector.record('info', 'analysis', `Server directory: ${runContext.buildDir}`);
    collector.record('info', 'analysis', `Workspace manifest: ${runContext.workspaceManifestPath}`);
    collector.record('info', 'analysis', `Report root: ${runContext.reportRootDir}`);
    collector.record('info', 'analysis', `Dependency validation mode: ${runContext.dependencyValidationMode}`);
    collector.record('info', 'analysis', `Arbiter profile: ${runContext.arbiterProfile}`);
    collector.record('info', 'analysis', `Deep-check mode: ${runContext.deepCheckMode}`);
    collector.record('info', 'analysis', `Iteration execution impact: ${executionImpact.kind}`);

    let effectiveStaticSnapshot = staticSnapshot;
    if (!effectiveStaticSnapshot || executionImpact.requiresBaseSnapshotBuild) {
        effectiveStaticSnapshot = await buildStaticSnapshot({
            modsPath,
            blockList,
            classificationContext,
            runContext,
            record: collector.record,
            progressReporter: effectiveProgressReporter
        });
    } else {
        collector.record('info', 'analysis', 'Reusing static snapshot from the current convergence session');
    }
    const resolvedStaticSnapshot = effectiveStaticSnapshot;

    if (!resolvedStaticSnapshot) {
        throw new Error('Static snapshot was not created');
    }

    let effectiveRealizedSnapshot = realizedSnapshot;
    if (
        !effectiveRealizedSnapshot
        || executionImpact.requiresSnapshotRealization
        || effectiveRealizedSnapshot.topologyPreference !== (runContext.preferredRuntimeTopologyId || null)
    ) {
        effectiveRealizedSnapshot = executionImpact.requiresBaseSnapshotBuild && resolvedStaticSnapshot.initialRealization.topologyPreference === (runContext.preferredRuntimeTopologyId || null)
            ? resolvedStaticSnapshot.initialRealization
            : realizeStaticSnapshot({
                snapshot: resolvedStaticSnapshot,
                runContext,
                record: collector.record,
                progressReporter: effectiveProgressReporter,
                emitProgressEvents: true
            });
    } else {
        collector.record('info', 'analysis', 'Reusing realized topology-aware snapshot for this candidate');
    }
    const resolvedRealizedSnapshot = effectiveRealizedSnapshot;

    if (!resolvedRealizedSnapshot) {
        throw new Error('Realized static snapshot was not created');
    }

    const decisions = applyCandidateDecisionFixes({
        decisions: resolvedRealizedSnapshot.decisions,
        forcedExcludes: effectiveMutations.forcedExcludes,
        forcedKeeps: effectiveMutations.forcedKeeps,
        record: collector.record
    });

    let effectiveWorkspaceSession = workspaceSession || createWorkspaceSession(runContext);
    let skeletonEntriesCopied = 0;

    if (!runContext.dryRun && !effectiveWorkspaceSession.baseWorkspaceReady) {
        const initializedWorkspace = initializeBaseWorkspace({
            session: effectiveWorkspaceSession,
            record: collector.record
        });
        skeletonEntriesCopied = initializedWorkspace.skeletonEntriesCopied;
    }

    effectiveProgressReporter.onStageStarted({
        stage: 'build',
        total: decisions.length,
        dryRun: runContext.dryRun
    });
    const candidateDelta = createCandidateDelta({
        decisions,
        session: effectiveWorkspaceSession,
        acceptEula: effectiveMutations.acceptEula
    });
    const materializedBuild = applyWorkspaceDelta({
        decisions,
        runContext,
        session: effectiveWorkspaceSession,
        delta: candidateDelta,
        skeletonEntriesCopied,
        record: collector.record,
        progressReporter: effectiveProgressReporter
    });
    const finalizedDecisions = materializedBuild.decisions;
    const stats = buildStats(finalizedDecisions);

    if (!runContext.dryRun && effectiveMutations.acceptEula && !effectiveWorkspaceSession.manifest.eulaAccepted) {
        const eulaPath = ensureServerEulaAccepted(runContext.buildDir);
        updateWorkspaceManifest(effectiveWorkspaceSession, {
            eulaAccepted: true
        });
        collector.record('info', 'build', `Convergence fix accepted EULA: ${eulaPath}`);
    }

    effectiveProgressReporter.onStageCompleted({
        stage: 'build',
        total: finalizedDecisions.length,
        dryRun: runContext.dryRun,
        summary: {
            ...stats,
            materializationMode: executionImpact.kind,
            linked: materializedBuild.stats.linked,
            reused: materializedBuild.stats.reused,
            restoredFromStash: materializedBuild.stats.restoredFromStash,
            movedToStash: materializedBuild.stats.movedToStash
        }
    });

    const runtimeDetection = detectPackRuntime({
        runContext,
        decisions: finalizedDecisions
    });
    collector.record('info', 'analysis', `Detected runtime loader: ${runtimeDetection.loader || 'unknown'}`);
    collector.record('info', 'analysis', `Detected runtime Minecraft version: ${runtimeDetection.minecraftVersion || 'unknown'}`);
    collector.record('info', 'analysis', `Detected runtime loader version: ${runtimeDetection.loaderVersion || 'unknown'}`);

    effectiveProgressReporter.onStageStarted({
        stage: 'server-core',
        total: finalizedDecisions.length,
        enabled: runContext.installServerCore
    });
    const serverCoreInstall = await installDetectedServerCore({
        runContext,
        runtimeDetection,
        record: collector.record
    });
    effectiveProgressReporter.onStageCompleted({
        stage: 'server-core',
        total: finalizedDecisions.length,
        status: serverCoreInstall.status,
        summary: {
            coreType: serverCoreInstall.coreType,
            minecraftVersion: serverCoreInstall.minecraftVersion,
            loaderVersion: serverCoreInstall.loaderVersion,
            entrypointPath: serverCoreInstall.entrypointPath,
            reason: serverCoreInstall.reason,
            cacheHit: serverCoreInstall.cacheHit
        },
        skipReason: serverCoreInstall.status === 'skipped' || serverCoreInstall.status === 'not-requested'
            ? serverCoreInstall.reason
            : null
    });

    let validationStage: ValidationStageResult = {
        validation: createEmptyValidation(runContext.validationMode)
    };
    const validationRunContext = serverCoreInstall.entrypointPath && !runContext.validationEntrypointPath
        ? {
            ...runContext,
            validationEntrypointPath: serverCoreInstall.entrypointPath
        }
        : runContext;

    effectiveProgressReporter.onStageStarted({
        stage: 'validation',
        total: finalizedDecisions.length,
        mode: validationRunContext.validationMode
    });
    if (serverCoreInstall.status === 'failed' && validationRunContext.validationMode !== 'off') {
        validationStage = {
            validation: createEmptyValidation(validationRunContext.validationMode, {
                code: 'SERVER_CORE_INSTALL_FAILED',
                message: serverCoreInstall.reason || 'Managed server core installation failed before validation'
            })
        };
    } else {
        try {
            validationStage = await runValidationStage({
                decisions: finalizedDecisions,
                runContext: validationRunContext,
                record: collector.record
            });
        } catch (error) {
            const serializedError = {
                code: getErrorCode(error, 'VALIDATION_STAGE_ERROR'),
                message: getErrorMessage(error)
            };

            collector.record('error', 'validation-error', `Validation stage crashed: ${getErrorMessage(error)}`);
            validationStage = {
                validation: createEmptyValidation(validationRunContext.validationMode, serializedError)
            };
        }
    }
    effectiveProgressReporter.onStageCompleted({
        stage: 'validation',
        total: finalizedDecisions.length,
        status: validationStage.validation.status,
        summary: {
            ...validationStage.validation.summary,
            sandboxLinkedFiles: validationStage.sandboxStats?.linkedFiles || 0,
            sandboxCopiedFiles: validationStage.sandboxStats?.copiedFiles || 0,
            sandboxCopiedDirectories: validationStage.sandboxStats?.copiedDirectories || 0
        },
        skipReason: validationStage.validation.skipReason || null
    });

    const completedAt = new Date().toISOString();
    const issues = collectReportIssues(finalizedDecisions);

    for (const error of resolvedRealizedSnapshot.dependencyGraph.errors) {
        issues.errors.push({
            fileName: null,
            source: 'dependency-graph',
            code: error.code,
            message: error.message,
            fatal: false
        });
    }

    for (const error of resolvedRealizedSnapshot.arbiter.errors) {
        issues.errors.push({
            fileName: null,
            source: 'arbiter',
            code: error.code,
            message: error.message,
            fatal: false
        });
    }

    for (const error of resolvedRealizedSnapshot.deepCheck.errors) {
        issues.errors.push({
            fileName: null,
            source: 'deep-check',
            code: error.code,
            message: error.message,
            fatal: false
        });
    }

    for (const warning of validationStage.validation.warnings || []) {
        issues.warnings.push({
            fileName: null,
            source: 'validation',
            code: 'VALIDATION_WARNING',
            message: warning
        });
    }

    for (const warning of runtimeDetection.warnings || []) {
        issues.warnings.push({
            fileName: null,
            source: 'runtime-detection',
            code: 'RUNTIME_DETECTION_WARNING',
            message: warning
        });
    }

    for (const error of validationStage.validation.errors || []) {
        issues.errors.push({
            fileName: null,
            source: 'validation',
            code: error.code,
            message: error.message,
            fatal: false
        });
    }

    if (serverCoreInstall.status === 'failed' && serverCoreInstall.reason) {
        issues.errors.push({
            fileName: null,
            source: 'server-core',
            code: 'SERVER_CORE_INSTALL_FAILED',
            message: serverCoreInstall.reason,
            fatal: false
        });
    } else if ((serverCoreInstall.status === 'skipped' || serverCoreInstall.status === 'not-requested') && serverCoreInstall.reason) {
        issues.warnings.push({
            fileName: null,
            source: 'server-core',
            code: 'SERVER_CORE_INSTALL_SKIPPED',
            message: serverCoreInstall.reason
        });
    }

    const report: RunReport = {
        run: {
            ...validationRunContext,
            detectedRuntime: runtimeDetection,
            completedAt,
            enabledEngines: resolvedStaticSnapshot.classificationContext.enabledEngines,
            registryFilePath: resolvedStaticSnapshot.classificationContext.localRegistry?.filePath ?? null,
            reviewOverridesPath: resolvedStaticSnapshot.reviewOverridesPath
        },
        stats,
        parsing: buildParsingStats(finalizedDecisions),
        classification: buildClassificationStats(finalizedDecisions, resolvedStaticSnapshot.classificationContext.enabledEngines),
        dependencyGraph: resolvedRealizedSnapshot.dependencyGraph,
        arbiter: resolvedRealizedSnapshot.arbiter,
        deepCheck: resolvedRealizedSnapshot.deepCheck,
        validation: validationStage.validation,
        probe: resolvedStaticSnapshot.probe,
        manualReview: resolvedRealizedSnapshot.manualReview,
        runtimeDetection,
        serverCoreInstall,
        workspace: {
            materializationMode: runContext.dryRun
                ? 'dry-run'
                : materializedBuild.stats.validationOnly
                    ? 'validation-only'
                    : iteration === 0
                        ? 'full-build'
                        : 'delta-materialization',
            manifestPath: runContext.workspaceManifestPath,
            stashModsDir: runContext.workspaceStashModsDir,
            currentActiveMods: effectiveWorkspaceSession.manifest.activeMods.length,
            delta: materializedBuild.delta,
            materialization: materializedBuild.stats,
            validationSandbox: validationStage.sandboxStats || null
        },
        decisions: finalizedDecisions,
        events: collector.events,
        warnings: issues.warnings,
        errors: issues.errors
    };
    const candidate = createCandidateState({
        runContext,
        report,
        candidateId,
        parentCandidateId,
        iteration,
        appliedFixes
    });

    return {
        candidate,
        report,
        staticSnapshot: resolvedStaticSnapshot,
        realizedSnapshot: resolvedRealizedSnapshot,
        workspaceSession: effectiveWorkspaceSession
    };
}

module.exports = {
    runInitialCandidateIteration
};
