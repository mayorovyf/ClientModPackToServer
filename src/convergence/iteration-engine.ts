const { createClassificationContext } = require('../classification/context');
const { buildClassificationStats } = require('../classification/temporary-merge-policy');
const { listJarFiles } = require('../io/mods-folder');
const { buildParsingStats } = require('../metadata/parse-mod-file');
const { createEmptyProbeSummary, runProbeStage } = require('../probe/run-probe-stage');
const { applyManualReviewOverrides, resolveReviewOverridesPath } = require('../review/manual-overrides');
const { detectPackRuntime } = require('../runtime/pack-runtime');
const { ensureServerEulaAccepted } = require('../server/runtime');
const { installDetectedServerCore } = require('../server/build-core');
const { createEmptyValidationReport } = require('../validation/report-model');
const { runValidationStage } = require('../validation/run-validation');
const {
    createEventCollector,
    createNoopProgressReporter,
    collectDecisions,
    reclassifyDecisions,
    applyBuildActions,
    buildStats,
    collectReportIssues,
    runDependencyStage,
    runArbiterStage,
    runDeepCheckStage
} = require('../build/builder');
const { createCandidateState } = require('./candidate-state');

import type { ApplicationLogger, BuildProgressReporter, ClassificationContextLike } from '../types/app';
import type { ClassificationContext } from '../types/classification';
import type { ProbeSummary } from '../types/probe';
import type { RunReport } from '../types/report';
import type { RunContext } from '../types/run';
import type { ValidationError, ValidationResult, ValidationStageResult } from '../types/validation';
import type { AppliedFix, CandidateIterationResult } from './types';

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
    mutations?: CandidateIterationMutations;
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
    mutations = {}
}: RunInitialCandidateIterationParams): Promise<CandidateIterationResult> {
    const effectiveProgressReporter = progressReporter || createNoopProgressReporter();
    const effectiveClassificationContext = (classificationContext || createClassificationContext({ blockList })) as ClassificationContextLike;
    const collector = createEventCollector(logger);
    const effectiveMutations = {
        forcedExcludes: Array.isArray(mutations?.forcedExcludes) ? mutations.forcedExcludes : [],
        forcedKeeps: Array.isArray(mutations?.forcedKeeps) ? mutations.forcedKeeps : [],
        acceptEula: Boolean(mutations?.acceptEula)
    };

    collector.record('info', 'analysis', `Run mode: ${runContext.mode}`);
    collector.record('info', 'analysis', `Input directory: ${runContext.inputPath}`);
    collector.record('info', 'analysis', `Instance directory: ${runContext.instancePath}`);
    collector.record('info', 'analysis', `Mods directory: ${modsPath}`);
    collector.record('info', 'analysis', `Build root: ${runContext.outputRootDir}`);
    collector.record('info', 'analysis', `Server directory: ${runContext.buildDir}`);
    collector.record('info', 'analysis', `Report root: ${runContext.reportRootDir}`);
    collector.record('info', 'analysis', `Classification engines: ${effectiveClassificationContext.enabledEngines.join(', ')}`);
    collector.record('info', 'analysis', `Dependency validation mode: ${runContext.dependencyValidationMode}`);
    collector.record('info', 'analysis', `Arbiter profile: ${runContext.arbiterProfile}`);
    collector.record('info', 'analysis', `Deep-check mode: ${runContext.deepCheckMode}`);

    const reviewOverridesPath = resolveReviewOverridesPath(process.cwd());
    collector.record('info', 'analysis', `Manual review overrides: ${reviewOverridesPath}`);

    const discoveredJarFiles = listJarFiles(modsPath);
    effectiveProgressReporter.onStageStarted({
        stage: 'classification',
        total: discoveredJarFiles.length
    });
    const { decisions: classifiedDecisions } = collectDecisions(
        modsPath,
        effectiveClassificationContext,
        runContext,
        collector.record,
        effectiveProgressReporter,
        discoveredJarFiles
    );
    effectiveProgressReporter.onStageCompleted({
        stage: 'classification',
        total: classifiedDecisions.length,
        summary: {
            parsed: classifiedDecisions.length
        }
    });
    collector.record('info', 'analysis', `Discovered .jar files: ${classifiedDecisions.length}`);

    let currentClassificationContext = effectiveClassificationContext;
    let currentClassifiedDecisions = classifiedDecisions;

    effectiveProgressReporter.onStageStarted({
        stage: 'dependency',
        total: currentClassifiedDecisions.length
    });
    let dependencyStage = runDependencyStage({
        decisions: currentClassifiedDecisions,
        runContext,
        record: collector.record
    });
    effectiveProgressReporter.onStageCompleted({
        stage: 'dependency',
        total: dependencyStage.decisions.length,
        status: dependencyStage.dependencyGraph.status,
        summary: dependencyStage.dependencyGraph.summary
    });

    effectiveProgressReporter.onStageStarted({
        stage: 'arbiter',
        total: dependencyStage.decisions.length,
        profile: runContext.arbiterProfile
    });
    let arbiterStage = runArbiterStage({
        decisions: dependencyStage.decisions,
        runContext,
        record: collector.record
    });
    effectiveProgressReporter.onStageCompleted({
        stage: 'arbiter',
        total: arbiterStage.decisions.length,
        status: arbiterStage.arbiter.status,
        summary: arbiterStage.arbiter.summary
    });

    effectiveProgressReporter.onStageStarted({
        stage: 'deep-check',
        total: arbiterStage.decisions.length,
        mode: runContext.deepCheckMode
    });
    let deepCheckStage = runDeepCheckStage({
        decisions: arbiterStage.decisions,
        runContext,
        record: collector.record
    });
    effectiveProgressReporter.onStageCompleted({
        stage: 'deep-check',
        total: deepCheckStage.decisions.length,
        status: deepCheckStage.deepCheck.status,
        summary: deepCheckStage.deepCheck.summary
    });

    let probeStage: ProbeSummary = createEmptyProbeSummary(
        runContext.probeMode,
        runContext.probeKnowledgePath,
        'Probe stage was not run'
    );

    effectiveProgressReporter.onStageStarted({
        stage: 'probe',
        total: deepCheckStage.decisions.length,
        mode: runContext.probeMode
    });
    const probeRun = await runProbeStage({
        decisions: deepCheckStage.decisions,
        runContext,
        knowledgePath: runContext.probeKnowledgePath,
        record: collector.record
    });
    probeStage = probeRun.summary;

    if (probeRun.knowledgeChanged && (probeStage.resolvedToKeep > 0 || probeStage.resolvedToRemove > 0 || runContext.probeMode === 'force')) {
        collector.record('info', 'probe', 'Re-running classification stages with updated probe knowledge');
        currentClassificationContext = createClassificationContext({
            blockList,
            localRegistry: effectiveClassificationContext.localRegistry || null,
            probeKnowledge: probeRun.updatedKnowledge,
            enabledEngines: effectiveClassificationContext.enabledEngines
        }) as ClassificationContextLike;
        currentClassifiedDecisions = reclassifyDecisions({
            decisions: classifiedDecisions,
            classificationContext: currentClassificationContext as ClassificationContext,
            runContext,
            record: collector.record
        });
        dependencyStage = runDependencyStage({
            decisions: currentClassifiedDecisions,
            runContext,
            record: collector.record
        });
        arbiterStage = runArbiterStage({
            decisions: dependencyStage.decisions,
            runContext,
            record: collector.record
        });
        deepCheckStage = runDeepCheckStage({
            decisions: arbiterStage.decisions,
            runContext,
            record: collector.record
        });
    }
    effectiveProgressReporter.onStageCompleted({
        stage: 'probe',
        total: probeStage.attempted,
        status: probeStage.status,
        summary: {
            planned: probeStage.planned,
            attempted: probeStage.attempted,
            reusedKnowledge: probeStage.reusedKnowledge,
            storedKnowledge: probeStage.storedKnowledge,
            resolvedToKeep: probeStage.resolvedToKeep,
            resolvedToRemove: probeStage.resolvedToRemove,
            inconclusive: probeStage.inconclusive
        },
        skipReason: probeStage.skipReason || null
    });

    const probeOutcomeByFile = new Map(probeStage.outcomes.map((outcome) => [outcome.fileName, outcome]));
    const manualReviewStage = applyManualReviewOverrides({
        decisions: deepCheckStage.decisions,
        overridesPath: reviewOverridesPath,
        record: collector.record
    });
    const decisionsWithProbe = manualReviewStage.decisions.map((decision: Record<string, any>) => {
        const probeOutcome = probeOutcomeByFile.get(decision.fileName);

        if (!probeOutcome) {
            return decision;
        }

        return {
            ...decision,
            probeOutcome: probeOutcome.outcome,
            probeReason: probeOutcome.reason,
            probeConfidence: probeOutcome.confidence,
            probeLogPath: probeOutcome.logPath || null
        };
    });
    const decisions = applyCandidateDecisionFixes({
        decisions: decisionsWithProbe,
        forcedExcludes: effectiveMutations.forcedExcludes,
        forcedKeeps: effectiveMutations.forcedKeeps,
        record: collector.record
    });

    for (const decision of decisions) {
        const engine = decision.classification ? decision.classification.winningEngine || 'conservative-default' : 'unknown';
        const semantic = decision.finalSemanticDecision || decision.arbiterDecision || 'unknown';
        const confidence = decision.finalConfidence || decision.arbiterConfidence || 'none';
        const roleType = decision.finalRoleType || 'unknown';
        collector.record(
            'info',
            'decision',
            `Decision ${decision.decision}: ${decision.fileName} | semantic: ${semantic} | role: ${roleType} | confidence: ${confidence} | engine: ${engine} | origin: ${decision.decisionOrigin} | ${decision.reason}`
        );
    }

    effectiveProgressReporter.onStageStarted({
        stage: 'build',
        total: decisions.length,
        dryRun: runContext.dryRun
    });
    const finalizedDecisions = applyBuildActions({
        decisions,
        runContext,
        record: collector.record,
        progressReporter: effectiveProgressReporter
    });
    const stats = buildStats(finalizedDecisions);

    if (!runContext.dryRun && effectiveMutations.acceptEula) {
        const eulaPath = ensureServerEulaAccepted(runContext.buildDir);
        collector.record('info', 'build', `Convergence fix accepted EULA: ${eulaPath}`);
    }

    effectiveProgressReporter.onStageCompleted({
        stage: 'build',
        total: finalizedDecisions.length,
        dryRun: runContext.dryRun,
        summary: stats
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
            reason: serverCoreInstall.reason
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
        summary: validationStage.validation.summary,
        skipReason: validationStage.validation.skipReason || null
    });

    const completedAt = new Date().toISOString();
    const issues = collectReportIssues(finalizedDecisions);

    for (const error of dependencyStage.dependencyGraph.errors) {
        issues.errors.push({
            fileName: null,
            source: 'dependency-graph',
            code: error.code,
            message: error.message,
            fatal: false
        });
    }

    for (const error of arbiterStage.arbiter.errors) {
        issues.errors.push({
            fileName: null,
            source: 'arbiter',
            code: error.code,
            message: error.message,
            fatal: false
        });
    }

    for (const error of deepCheckStage.deepCheck.errors) {
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
            enabledEngines: currentClassificationContext.enabledEngines,
            registryFilePath: currentClassificationContext.localRegistry?.filePath ?? null,
            reviewOverridesPath
        },
        stats,
        parsing: buildParsingStats(finalizedDecisions),
        classification: buildClassificationStats(finalizedDecisions, currentClassificationContext.enabledEngines),
        dependencyGraph: dependencyStage.dependencyGraph,
        arbiter: arbiterStage.arbiter,
        deepCheck: deepCheckStage.deepCheck,
        validation: validationStage.validation,
        probe: probeStage,
        manualReview: manualReviewStage.summary,
        runtimeDetection,
        serverCoreInstall,
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
        report
    };
}

module.exports = {
    runInitialCandidateIteration
};
