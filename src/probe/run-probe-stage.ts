const { createProbePlan } = require('./planner');
const { loadProbeKnowledge, upsertProbeKnowledgeEntry } = require('./knowledge-store');
const { runProbeStep } = require('./runner');
const { PROBE_MODES } = require('./constants');

import type { ProbeKnowledgeEntry, ProbeSummary } from '../types/probe';
import type { RunContext } from '../types/run';

function createEmptyProbeSummary(mode: RunContext['probeMode'], knowledgePath: string | null, skipReason: string | null = null): ProbeSummary {
    return {
        status: skipReason ? 'skipped' : 'completed',
        mode,
        attempted: 0,
        planned: 0,
        reusedKnowledge: 0,
        storedKnowledge: 0,
        resolvedToKeep: 0,
        resolvedToRemove: 0,
        inconclusive: 0,
        skipReason,
        knowledgePath,
        outcomes: [],
        errors: []
    };
}

function outcomeToKnowledgeEntry({
    outcome,
    descriptor
}: {
    outcome: ProbeSummary['outcomes'][number];
    descriptor: Record<string, any>;
}): ProbeKnowledgeEntry {
    return {
        fingerprint: {
            fileSha256: descriptor.fileSha256 || null,
            fileName: descriptor.fileName,
            loader: descriptor.loader,
            version: descriptor.version || null,
            modIds: [...(descriptor.modIds || [])].sort((left: string, right: string) => left.localeCompare(right))
        },
        outcome: outcome.outcome,
        semanticDecision: outcome.semanticDecision,
        roleType: outcome.roleType,
        confidence: outcome.confidence,
        reason: outcome.reason,
        evidence: outcome.evidence,
        observedAt: new Date().toISOString(),
        source: 'server-probe',
        exactBoot: outcome.outcome === 'server_boot_ok'
    };
}

async function runProbeStage({
    decisions,
    runContext,
    knowledgePath,
    record = () => {}
}: {
    decisions: Array<Record<string, any>>;
    runContext: RunContext;
    knowledgePath: string;
    record?: (level: string, kind: string, message: string) => void;
}): Promise<{
    summary: ProbeSummary;
    updatedKnowledge: {
        filePath: string;
        entries: ProbeKnowledgeEntry[];
    };
    knowledgeChanged: boolean;
}> {
    if (runContext.probeMode === PROBE_MODES.off) {
        return {
            summary: createEmptyProbeSummary(runContext.probeMode, knowledgePath, 'Probe stage disabled by configuration'),
            updatedKnowledge: {
                filePath: knowledgePath,
                entries: loadProbeKnowledge(knowledgePath).entries
            },
            knowledgeChanged: false
        };
    }

    const existingKnowledge = loadProbeKnowledge(knowledgePath);
    const plan = createProbePlan({
        decisions,
        knowledge: existingKnowledge,
        maxMods: runContext.probeMaxMods,
        mode: runContext.probeMode
    });

    if (plan.length === 0) {
        return {
            summary: createEmptyProbeSummary(runContext.probeMode, knowledgePath, 'No unresolved review mods qualified for probing'),
            updatedKnowledge: {
                filePath: knowledgePath,
                entries: existingKnowledge.entries
            },
            knowledgeChanged: false
        };
    }

    const decisionMap = new Map(decisions.map((decision) => [decision.fileName, decision]));
    let nextKnowledge = existingKnowledge;
    let knowledgeChanged = false;
    const summary: ProbeSummary = {
        ...createEmptyProbeSummary(runContext.probeMode, knowledgePath, null),
        status: 'completed',
        planned: plan.length
    };

    for (const step of plan) {
        const decision = decisionMap.get(step.fileName);

        if (!decision || !decision.descriptor) {
            continue;
        }

        const supportSourcePaths = step.requiredSupportFiles
            .map((fileName: string) => decisionMap.get(fileName))
            .filter((supportDecision: Record<string, any> | undefined): supportDecision is Record<string, any> => Boolean(supportDecision && supportDecision.sourcePath))
            .map((supportDecision: Record<string, any>) => supportDecision.sourcePath);
        const outcome = await runProbeStep({
            step,
            runContext,
            descriptor: decision.descriptor,
            currentRoleType: decision.finalRoleType || 'unknown',
            supportSourcePaths,
            record
        });

        summary.attempted += 1;
        summary.outcomes.push(outcome);

        if (outcome.semanticDecision === 'keep') {
            summary.resolvedToKeep += 1;
        } else if (outcome.semanticDecision === 'remove') {
            summary.resolvedToRemove += 1;
        } else {
            summary.inconclusive += 1;
        }

        if (outcome.semanticDecision !== 'unknown' || runContext.probeMode === PROBE_MODES.force) {
            nextKnowledge = upsertProbeKnowledgeEntry({
                knowledgePath,
                entry: outcomeToKnowledgeEntry({
                    outcome,
                    descriptor: decision.descriptor
                })
            });
            knowledgeChanged = true;
            summary.storedKnowledge += 1;
        }
    }

    return {
        summary,
        updatedKnowledge: {
            filePath: knowledgePath,
            entries: nextKnowledge.entries
        },
        knowledgeChanged
    };
}

module.exports = {
    createEmptyProbeSummary,
    runProbeStage
};
