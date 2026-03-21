const { createClassificationContext } = require('../classification/context');
const { listJarFiles } = require('../io/mods-folder');
const { createEmptyProbeSummary, runProbeStage } = require('../probe/run-probe-stage');
const { applyManualReviewOverrides, resolveReviewOverridesPath } = require('../review/manual-overrides');
const { detectPackRuntime } = require('../runtime/pack-runtime');
const { applyTopologyArtifactPartitioning } = require('../topology/artifact-partitioning');
const {
    createNoopProgressReporter,
    collectDecisions,
    reclassifyDecisions,
    runDependencyStage,
    runArbiterStage,
    runDeepCheckStage
} = require('../build/builder');

import type { BuildProgressReporter, ClassificationContextLike } from '../types/app';
import type { ProbeSummary } from '../types/probe';
import type { RunContext } from '../types/run';

interface DecisionLike {
    fileName: string;
    probeOutcome?: string | null;
    probeReason?: string | null;
    probeConfidence?: string | null;
    probeLogPath?: string | null;
    [key: string]: any;
}

export interface RealizedStaticSnapshot {
    topologyPreference: RunContext['preferredRuntimeTopologyId'];
    decisions: DecisionLike[];
    dependencyGraph: any;
    arbiter: any;
    deepCheck: any;
    manualReview: any;
    runtimeDetection: any;
}

export interface BaseStaticSnapshot {
    jarFiles: string[];
    classificationContext: ClassificationContextLike;
    reviewOverridesPath: string;
    probe: ProbeSummary;
    classifiedDecisions: DecisionLike[];
    initialRealization: RealizedStaticSnapshot;
}

function attachProbeOutcomes({
    decisions,
    probeSummary
}: {
    decisions: DecisionLike[];
    probeSummary: ProbeSummary;
}): DecisionLike[] {
    const probeOutcomeByFile = new Map(probeSummary.outcomes.map((outcome) => [outcome.fileName, outcome]));

    return decisions.map((decision) => {
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
}

function realizeStaticSnapshot({
    snapshot,
    runContext,
    record = () => {},
    progressReporter = null,
    emitProgressEvents = true
}: {
    snapshot: Pick<BaseStaticSnapshot, 'classifiedDecisions' | 'probe' | 'reviewOverridesPath'>;
    runContext: RunContext;
    record?: (level: string, kind: string, message: string) => void;
    progressReporter?: BuildProgressReporter | null;
    emitProgressEvents?: boolean;
}): RealizedStaticSnapshot {
    const effectiveProgressReporter = progressReporter || createNoopProgressReporter();
    const runtimeDetection = detectPackRuntime({
        runContext,
        decisions: snapshot.classifiedDecisions
    });
    const partitioned = applyTopologyArtifactPartitioning({
        decisions: snapshot.classifiedDecisions,
        runContext,
        runtimeDetection,
        record
    });
    if (emitProgressEvents) {
        effectiveProgressReporter.onStageStarted({
            stage: 'dependency',
            total: partitioned.decisions.length
        });
    }
    const dependencyStage = runDependencyStage({
        decisions: partitioned.decisions,
        runContext,
        record
    });
    if (emitProgressEvents) {
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
    }
    const arbiterStage = runArbiterStage({
        decisions: dependencyStage.decisions,
        runContext,
        record
    });
    if (emitProgressEvents) {
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
    }
    const deepCheckStage = runDeepCheckStage({
        decisions: arbiterStage.decisions,
        runContext,
        record
    });
    if (emitProgressEvents) {
        effectiveProgressReporter.onStageCompleted({
            stage: 'deep-check',
            total: deepCheckStage.decisions.length,
            status: deepCheckStage.deepCheck.status,
            summary: deepCheckStage.deepCheck.summary
        });
    }
    const manualReviewStage = applyManualReviewOverrides({
        decisions: deepCheckStage.decisions,
        overridesPath: snapshot.reviewOverridesPath,
        record
    });
    const decisions = attachProbeOutcomes({
        decisions: manualReviewStage.decisions,
        probeSummary: snapshot.probe
    });

    return {
        topologyPreference: runContext.preferredRuntimeTopologyId || null,
        decisions,
        dependencyGraph: dependencyStage.dependencyGraph,
        arbiter: arbiterStage.arbiter,
        deepCheck: deepCheckStage.deepCheck,
        manualReview: manualReviewStage.summary,
        runtimeDetection
    };
}

async function buildStaticSnapshot({
    modsPath,
    blockList = [],
    classificationContext = null,
    runContext,
    record = () => {},
    progressReporter = null
}: {
    modsPath: string;
    blockList?: string[];
    classificationContext?: ClassificationContextLike | null;
    runContext: RunContext;
    record?: (level: string, kind: string, message: string) => void;
    progressReporter?: BuildProgressReporter | null;
}): Promise<BaseStaticSnapshot> {
    const effectiveProgressReporter = progressReporter || createNoopProgressReporter();
    let currentClassificationContext = (classificationContext || createClassificationContext({ blockList })) as ClassificationContextLike;
    const reviewOverridesPath = resolveReviewOverridesPath(process.cwd());
    const jarFiles = listJarFiles(modsPath);

    effectiveProgressReporter.onStageStarted({
        stage: 'classification',
        total: jarFiles.length
    });
    const collected = collectDecisions(
        modsPath,
        currentClassificationContext,
        runContext,
        record,
        effectiveProgressReporter,
        jarFiles
    );
    effectiveProgressReporter.onStageCompleted({
        stage: 'classification',
        total: collected.decisions.length,
        summary: {
            parsed: collected.decisions.length
        }
    });

    let classifiedDecisions = collected.decisions;
    let initialRealization = realizeStaticSnapshot({
        snapshot: {
            classifiedDecisions,
            probe: createEmptyProbeSummary(
                runContext.probeMode,
                runContext.probeKnowledgePath,
                'Probe stage was not run'
            ),
            reviewOverridesPath
        },
        runContext,
        record,
        progressReporter: effectiveProgressReporter,
        emitProgressEvents: true
    });

    effectiveProgressReporter.onStageStarted({
        stage: 'probe',
        total: initialRealization.decisions.length,
        mode: runContext.probeMode
    });
    const probeRun = await runProbeStage({
        decisions: initialRealization.decisions,
        runContext,
        knowledgePath: runContext.probeKnowledgePath,
        record,
        progressReporter: effectiveProgressReporter
    });
    let probeSummary = probeRun.summary;

    if (probeRun.knowledgeChanged && (probeSummary.resolvedToKeep > 0 || probeSummary.resolvedToRemove > 0 || runContext.probeMode === 'force')) {
        record('info', 'probe', 'Re-running static classification with updated probe knowledge');
        currentClassificationContext = createClassificationContext({
            blockList,
            localRegistry: currentClassificationContext.localRegistry || null,
            probeKnowledge: probeRun.updatedKnowledge,
            enabledEngines: currentClassificationContext.enabledEngines
        }) as ClassificationContextLike;
        classifiedDecisions = reclassifyDecisions({
            decisions: collected.decisions,
            classificationContext: currentClassificationContext,
            runContext,
            record
        });
    }

    initialRealization = realizeStaticSnapshot({
        snapshot: {
            classifiedDecisions,
            probe: probeSummary,
            reviewOverridesPath
        },
        runContext,
        record,
        progressReporter: effectiveProgressReporter,
        emitProgressEvents: false
    });

    effectiveProgressReporter.onStageCompleted({
        stage: 'probe',
        total: probeSummary.attempted,
        status: probeSummary.status,
        summary: {
            planned: probeSummary.planned,
            attempted: probeSummary.attempted,
            reusedKnowledge: probeSummary.reusedKnowledge,
            storedKnowledge: probeSummary.storedKnowledge,
            resolvedToKeep: probeSummary.resolvedToKeep,
            resolvedToRemove: probeSummary.resolvedToRemove,
            inconclusive: probeSummary.inconclusive
        },
        skipReason: probeSummary.skipReason || null
    });

    return {
        jarFiles,
        classificationContext: currentClassificationContext,
        reviewOverridesPath,
        probe: probeSummary,
        classifiedDecisions,
        initialRealization
    };
}

module.exports = {
    buildStaticSnapshot,
    realizeStaticSnapshot
};
