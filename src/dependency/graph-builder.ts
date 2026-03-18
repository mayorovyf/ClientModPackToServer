const { GRAPH_RESOLUTIONS } = require('./constants');
const { buildProviderIndex, collectProvidedIds, lookupProviders } = require('./provider-index');
const { isPlatformDependency } = require('./platform-dependencies');

import type {
    DependencyEdge,
    DependencyGraph,
    DependencyIncomingEntry,
    DependencyNode,
    DependencyProviderIndex
} from '../types/dependency';
import type { DependencyDescriptor } from '../types/metadata';

function buildEdge({
    decision,
    dependency,
    kind,
    providerIndex
}: {
    decision: Record<string, any>;
    dependency: DependencyDescriptor;
    kind: DependencyEdge['kind'];
    providerIndex: DependencyProviderIndex;
}): DependencyEdge {
    const providers = lookupProviders(providerIndex, dependency.modId);
    const providerFileNames: string[] = Array.from(
        new Set<string>(providers.map((provider: { fileName: string }) => provider.fileName))
    ).sort();

    let resolution: DependencyEdge['resolution'] = GRAPH_RESOLUTIONS.missing;

    if (isPlatformDependency(dependency.modId)) {
        resolution = GRAPH_RESOLUTIONS.platform;
    } else if (providerFileNames.length === 1) {
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
        versionRange: dependency.versionRange || null,
        sideHint: dependency.sideHint || null,
        resolution,
        providerFileNames,
        providers
    };
}

function createIncomingSummary(): DependencyGraph['incoming'] {
    return {
        requiredByFile: {},
        optionalByFile: {},
        incompatibleWithFile: {}
    };
}

function pushIncomingEdge(bucket: Record<string, DependencyIncomingEntry[]>, fileName: string, edge: DependencyEdge): void {
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

function buildDependencyGraph(decisions: Array<Record<string, any>> = []): DependencyGraph {
    const providerIndex = buildProviderIndex(decisions);
    const incoming = createIncomingSummary();
    const edges: DependencyEdge[] = [];

    const nodes: DependencyNode[] = decisions.map((decision) => {
        const descriptor = decision.descriptor || {};
        const requiredEdges = (descriptor.dependencies || []).map((dependency: DependencyDescriptor) =>
            buildEdge({
                decision,
                dependency,
                kind: 'required',
                providerIndex
            })
        );
        const optionalEdges = (descriptor.optionalDependencies || []).map((dependency: DependencyDescriptor) =>
            buildEdge({
                decision,
                dependency,
                kind: 'optional',
                providerIndex
            })
        );
        const incompatibilityEdges = (descriptor.incompatibilities || []).map((dependency: DependencyDescriptor) =>
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
            modIds: [...((descriptor.modIds || []) as string[])],
            provides: [...((descriptor.provides || []) as string[])],
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
