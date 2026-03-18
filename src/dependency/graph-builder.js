const { GRAPH_RESOLUTIONS } = require('./constants');
const { buildProviderIndex, collectProvidedIds, lookupProviders } = require('./provider-index');

function buildEdge({ decision, dependency, kind, providerIndex }) {
    const providers = lookupProviders(providerIndex, dependency.modId);
    const providerFileNames = [...new Set(providers.map((provider) => provider.fileName))].sort();

    let resolution = GRAPH_RESOLUTIONS.missing;

    if (providerFileNames.length === 1) {
        resolution = providerFileNames[0] === decision.fileName ? GRAPH_RESOLUTIONS.self : GRAPH_RESOLUTIONS.unique;
    } else if (providerFileNames.length > 1) {
        resolution = GRAPH_RESOLUTIONS.ambiguous;
    }

    return {
        fromFileName: decision.fileName,
        modId: dependency.modId,
        kind,
        required: kind === 'required',
        loaderOrigin: dependency.loaderOrigin,
        versionRange: dependency.versionRange,
        sideHint: dependency.sideHint,
        resolution,
        providerFileNames,
        providers
    };
}

function createIncomingSummary() {
    return {
        requiredByFile: {},
        optionalByFile: {},
        incompatibleWithFile: {}
    };
}

function pushIncomingEdge(bucket, fileName, edge) {
    if (!bucket[fileName]) {
        bucket[fileName] = [];
    }

    bucket[fileName].push({
        fileName: edge.fromFileName,
        modId: edge.modId,
        kind: edge.kind,
        loaderOrigin: edge.loaderOrigin,
        versionRange: edge.versionRange,
        sideHint: edge.sideHint
    });
}

function buildDependencyGraph(decisions = []) {
    const providerIndex = buildProviderIndex(decisions);
    const incoming = createIncomingSummary();
    const edges = [];

    const nodes = decisions.map((decision) => {
        const descriptor = decision.descriptor || {};
        const requiredEdges = (descriptor.dependencies || []).map((dependency) =>
            buildEdge({
                decision,
                dependency,
                kind: 'required',
                providerIndex
            })
        );
        const optionalEdges = (descriptor.optionalDependencies || []).map((dependency) =>
            buildEdge({
                decision,
                dependency,
                kind: 'optional',
                providerIndex
            })
        );
        const incompatibilityEdges = (descriptor.incompatibilities || []).map((dependency) =>
            buildEdge({
                decision,
                dependency,
                kind: 'incompatibility',
                providerIndex
            })
        );
        const providedIds = collectProvidedIds(descriptor);

        for (const edge of requiredEdges) {
            edges.push(edge);

            if (edge.resolution === GRAPH_RESOLUTIONS.unique || edge.resolution === GRAPH_RESOLUTIONS.self) {
                pushIncomingEdge(incoming.requiredByFile, edge.providerFileNames[0], edge);
            }
        }

        for (const edge of optionalEdges) {
            edges.push(edge);

            if (edge.resolution === GRAPH_RESOLUTIONS.unique || edge.resolution === GRAPH_RESOLUTIONS.self) {
                pushIncomingEdge(incoming.optionalByFile, edge.providerFileNames[0], edge);
            }
        }

        for (const edge of incompatibilityEdges) {
            edges.push(edge);

            for (const providerFileName of edge.providerFileNames) {
                pushIncomingEdge(incoming.incompatibleWithFile, providerFileName, edge);
            }
        }

        return {
            fileName: decision.fileName,
            loader: descriptor.loader || 'unknown',
            modIds: [...(descriptor.modIds || [])],
            provides: [...(descriptor.provides || [])],
            providedIds,
            initialDecision: decision.decision,
            classificationDecision: decision.classification ? decision.classification.finalDecision : decision.decision === 'exclude' ? 'remove' : 'keep',
            requiredEdges,
            optionalEdges,
            incompatibilityEdges
        };
    });

    const summary = {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        requiredEdges: edges.filter((edge) => edge.kind === 'required').length,
        optionalEdges: edges.filter((edge) => edge.kind === 'optional').length,
        incompatibilityEdges: edges.filter((edge) => edge.kind === 'incompatibility').length,
        multiModJars: nodes.filter((node) => node.modIds.length > 1).length,
        providedIds: providerIndex.summary.uniqueProvidedIds,
        ambiguousProviderIds: providerIndex.summary.ambiguousIdsCount
    };

    return {
        providerIndex,
        nodes,
        edges,
        incoming,
        summary
    };
}

module.exports = {
    buildDependencyGraph
};
