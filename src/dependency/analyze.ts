const { finalizeDecision } = require('../build/decision-model');
const { VALIDATION_MODES } = require('./constants');
const { buildDependencyGraph } = require('./graph-builder');
const { applyDependencyRolePropagation } = require('./role-propagation');
const { runDependencyValidation } = require('./validator');

import type { DependencyGraph, DependencyValidationMode } from '../types/dependency';

function analyzeDependencies({
    decisions,
    mode = VALIDATION_MODES.conservative,
    record = () => {}
}: {
    decisions: Array<Record<string, any>>;
    mode?: DependencyValidationMode;
    record?: (level: string, kind: string, message: string) => void;
}) {
    const topologyEligibleDecisions = decisions.filter((decision) => decision.topologyPartition !== 'topology-incompatible-artifact');

    record(
        'info',
        'graph',
        `Building dependency graph for ${topologyEligibleDecisions.length}/${decisions.length} topology-eligible jar(s)`
    );
    const initialGraph: DependencyGraph = buildDependencyGraph(topologyEligibleDecisions);
    record(
        'info',
        'graph',
        `Dependency graph built: nodes=${initialGraph.summary.totalNodes}, edges=${initialGraph.summary.totalEdges}, ambiguousProviders=${initialGraph.summary.ambiguousProviderIds}`
    );
    const propagation = applyDependencyRolePropagation({
        decisions: topologyEligibleDecisions,
        graph: initialGraph,
        record
    });
    const graph: DependencyGraph = buildDependencyGraph(propagation.decisions);

    const validation = runDependencyValidation({
        decisions: propagation.decisions,
        graph,
        initialFindingsByFile: propagation.initialFindingsByFile,
        mode,
        record
    });

    record(
        'info',
        'graph',
        `Dependency validation complete: findings=${validation.summary.totalFindings}, preserved=${validation.summary.preservedByDependency}, missingRequired=${validation.summary.missingRequired}`
    );

    const propagatedDecisionByFile = new Map(propagation.decisions.map((decision: Record<string, any>) => [decision.fileName, decision]));
    const adjustedDecisions = decisions.map((decision: Record<string, any>) => {
        const effectiveDecision = propagatedDecisionByFile.get(decision.fileName) || decision;

        return finalizeDecision(effectiveDecision, validation.decisionUpdatesByFile[decision.fileName] || {});
    });
    const reportedProviderIndex = {
        ...graph.providerIndex,
        byId: Object.fromEntries(
            Object.entries(graph.providerIndex.byId).map(([providedId, providers]) => [
                providedId,
                providers.map((provider) => ({
                    ...provider,
                    effectiveDecision: validation.effectiveDecisionByFile[provider.fileName] || provider.currentDecision
                }))
            ])
        ),
        providerEntries: graph.providerIndex.providerEntries.map((provider) => ({
            ...provider,
            effectiveDecision: validation.effectiveDecisionByFile[provider.fileName] || provider.currentDecision
        }))
    };

    return {
        decisions: adjustedDecisions,
        report: {
            status: 'ok',
            mode,
            summary: {
                ...validation.summary,
                rolePropagations: propagation.summary.rolePropagations,
                roleKeepConstraints: propagation.summary.roleKeepConstraints,
                roleRemoveSignals: propagation.summary.roleRemoveSignals
            },
            providerIndex: reportedProviderIndex,
            nodes: graph.nodes.map((node) => ({
                ...node,
                effectiveDecision: validation.effectiveDecisionByFile[node.fileName] || node.initialDecision
            })),
            edges: graph.edges,
            findings: validation.findings,
            errors: []
        }
    };
}

module.exports = {
    analyzeDependencies
};
