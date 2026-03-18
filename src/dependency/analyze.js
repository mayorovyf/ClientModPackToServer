const { finalizeDecision } = require('../build/decision-model');
const { VALIDATION_MODES } = require('./constants');
const { buildDependencyGraph } = require('./graph-builder');
const { runDependencyValidation } = require('./validator');

function analyzeDependencies({ decisions, mode = VALIDATION_MODES.conservative, record = () => {} }) {
    record('info', 'graph', `Building dependency graph for ${decisions.length} jar(s)`);
    const graph = buildDependencyGraph(decisions);
    record(
        'info',
        'graph',
        `Dependency graph built: nodes=${graph.summary.totalNodes}, edges=${graph.summary.totalEdges}, ambiguousProviders=${graph.summary.ambiguousProviderIds}`
    );

    const validation = runDependencyValidation({
        decisions,
        graph,
        mode,
        record
    });

    record(
        'info',
        'graph',
        `Dependency validation complete: findings=${validation.summary.totalFindings}, preserved=${validation.summary.preservedByDependency}, missingRequired=${validation.summary.missingRequired}`
    );

    const adjustedDecisions = decisions.map((decision) =>
        finalizeDecision(decision, validation.decisionUpdatesByFile[decision.fileName] || {})
    );
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
            summary: validation.summary,
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
