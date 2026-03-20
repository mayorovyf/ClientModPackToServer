const { assessRuntimeTopology } = require('./assessment');
const { isKnownConnectorArtifact, listArtifactCompatibleLoaders } = require('./topology-helpers');

import type { PackRuntimeDetection } from '../types/runtime-detection';
import type { LoaderKind } from '../types/metadata';
import type { RuntimeTopologyAssessment, TopologyArtifactPartitionKind } from '../types/topology';
import type { RunContext } from '../types/run';

interface DecisionLike {
    fileName: string;
    descriptor?: {
        loader?: LoaderKind | 'unknown';
        modIds?: string[] | null;
        displayName?: string | null;
        manifestHints?: Record<string, string> | null;
        metadataFilesFound?: string[] | null;
    } | null;
    topologyPartition?: TopologyArtifactPartitionKind | null;
    topologyReason?: string | null;
    selectedRuntimeTopologyId?: RuntimeTopologyAssessment['topologyId'];
    decision?: 'keep' | 'exclude';
    reason?: string;
    decisionOrigin?: string;
}

interface PartitionSummary {
    targetRuntimeArtifacts: number;
    connectorLayerArtifacts: number;
    topologyIncompatibleArtifacts: number;
    unresolvedArtifacts: number;
}

interface PartitionResult {
    decisions: DecisionLike[];
    topologyAssessment: RuntimeTopologyAssessment;
    summary: PartitionSummary;
}

function createEmptySummary(): PartitionSummary {
    return {
        targetRuntimeArtifacts: 0,
        connectorLayerArtifacts: 0,
        topologyIncompatibleArtifacts: 0,
        unresolvedArtifacts: 0
    };
}

function incrementSummary(summary: PartitionSummary, partition: TopologyArtifactPartitionKind): void {
    switch (partition) {
        case 'target-runtime-artifact':
            summary.targetRuntimeArtifacts += 1;
            break;
        case 'connector-layer-artifact':
            summary.connectorLayerArtifacts += 1;
            break;
        case 'topology-incompatible-artifact':
            summary.topologyIncompatibleArtifacts += 1;
            break;
        default:
            summary.unresolvedArtifacts += 1;
            break;
    }
}

function createPartitionedDecision({
    decision,
    topologyAssessment,
    partition,
    topologyReason
}: {
    decision: DecisionLike;
    topologyAssessment: RuntimeTopologyAssessment;
    partition: TopologyArtifactPartitionKind;
    topologyReason: string;
}): DecisionLike {
    return {
        ...decision,
        selectedRuntimeTopologyId: topologyAssessment.topologyId,
        topologyPartition: partition,
        topologyReason
    };
}

function partitionDecision({
    decision,
    topologyAssessment
}: {
    decision: DecisionLike;
    topologyAssessment: RuntimeTopologyAssessment;
}): DecisionLike {
    const topologyId = topologyAssessment.topologyId;
    const loader = decision.descriptor?.loader || 'unknown';
    const baseLoader = topologyAssessment.baseLoader;
    const bridgedEcosystem = topologyAssessment.bridgedEcosystem;
    const connectorArtifact = isKnownConnectorArtifact(decision);
    const compatibleLoaders = listArtifactCompatibleLoaders(decision);

    if (topologyAssessment.assessment !== 'supported' || !topologyId) {
        return createPartitionedDecision({
            decision,
            topologyAssessment,
            partition: 'unresolved-artifact',
            topologyReason: `No whitelist-supported runtime topology was selected for ${decision.fileName}; artifact partitioning stays unresolved.`
        });
    }

    if (connectorArtifact && topologyAssessment.connectorLayer) {
        return createPartitionedDecision({
            decision,
            topologyAssessment,
            partition: 'connector-layer-artifact',
            topologyReason: `Included ${decision.fileName} as connector-layer artifact for runtime topology ${topologyId}.`
        });
    }

    if (connectorArtifact && !topologyAssessment.connectorLayer) {
        return createPartitionedDecision({
            decision,
            topologyAssessment,
            partition: 'topology-incompatible-artifact',
            topologyReason: `Excluded ${decision.fileName} from runtime topology ${topologyId} because this topology does not include a connector layer.`
        });
    }

    if (loader === 'unknown') {
        return createPartitionedDecision({
            decision,
            topologyAssessment,
            partition: 'unresolved-artifact',
            topologyReason: `Could not map ${decision.fileName} to runtime topology ${topologyId} because loader metadata is unknown.`
        });
    }

    if (baseLoader && compatibleLoaders.includes(baseLoader)) {
        return createPartitionedDecision({
            decision,
            topologyAssessment,
            partition: 'target-runtime-artifact',
            topologyReason: `Included ${decision.fileName} as base-loader artifact for runtime topology ${topologyId}.`
        });
    }

    if (bridgedEcosystem && compatibleLoaders.includes(bridgedEcosystem)) {
        return createPartitionedDecision({
            decision,
            topologyAssessment,
            partition: 'target-runtime-artifact',
            topologyReason: `Included ${decision.fileName} as bridged ${bridgedEcosystem} artifact for runtime topology ${topologyId}.`
        });
    }

    return createPartitionedDecision({
        decision,
        topologyAssessment,
        partition: 'topology-incompatible-artifact',
        topologyReason: `Excluded ${decision.fileName} from runtime topology ${topologyId} because loader ${loader} is topology-incompatible.`
    });
}

function applyTopologyArtifactPartitioning({
    decisions,
    runContext,
    runtimeDetection = null,
    record = () => {}
}: {
    decisions: DecisionLike[];
    runContext: RunContext;
    runtimeDetection?: PackRuntimeDetection | null;
    record?: (level: string, kind: string, message: string) => void;
}): PartitionResult {
    const topologyAssessment = assessRuntimeTopology({
        runContext,
        decisions,
        runtimeDetection,
        isFinal: true
    });
    const summary = createEmptySummary();
    const partitionedDecisions = decisions.map((decision) => {
        const partitionedDecision = partitionDecision({
            decision,
            topologyAssessment
        });

        incrementSummary(summary, partitionedDecision.topologyPartition || 'unresolved-artifact');
        return partitionedDecision;
    });

    record(
        'info',
        'analysis',
        `Topology-aware synthesis selected ${topologyAssessment.topologyId || topologyAssessment.assessment}: `
        + `target=${summary.targetRuntimeArtifacts}, connector=${summary.connectorLayerArtifacts}, `
        + `incompatible=${summary.topologyIncompatibleArtifacts}, unresolved=${summary.unresolvedArtifacts}`
    );

    return {
        decisions: partitionedDecisions,
        topologyAssessment,
        summary
    };
}

module.exports = {
    applyTopologyArtifactPartitioning
};
