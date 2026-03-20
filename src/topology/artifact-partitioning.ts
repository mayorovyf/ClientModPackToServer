const { assessRuntimeTopology } = require('./assessment');

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

function normalizeString(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null;
    }

    const normalized = String(value).trim();
    return normalized ? normalized : null;
}

function collectDecisionTokens(decision: DecisionLike): string[] {
    const tokens: string[] = [];
    const fileName = normalizeString(decision.fileName);
    const displayName = normalizeString(decision.descriptor?.displayName);

    if (fileName) {
        tokens.push(fileName.toLowerCase());
    }

    if (displayName) {
        tokens.push(displayName.toLowerCase());
    }

    for (const modId of decision.descriptor?.modIds || []) {
        const normalizedModId = normalizeString(modId);

        if (normalizedModId) {
            tokens.push(normalizedModId.toLowerCase());
        }
    }

    for (const value of Object.values(decision.descriptor?.manifestHints || {})) {
        const normalizedValue = normalizeString(value);

        if (normalizedValue) {
            tokens.push(normalizedValue.toLowerCase());
        }
    }

    return [...new Set(tokens)];
}

function isConnectorLayerArtifact(decision: DecisionLike, connectorLayer: RuntimeTopologyAssessment['connectorLayer']): boolean {
    if (!connectorLayer) {
        return false;
    }

    const tokens = collectDecisionTokens(decision);

    if (connectorLayer === 'sinytra-connector') {
        return tokens.some((token) => token.includes('sinytra-connector') || token.includes('sinytra_connector'))
            || (tokens.some((token) => token.includes('sinytra')) && tokens.some((token) => token.includes('connector')));
    }

    return tokens.some((token) => token.includes('connector') || token.includes('bridge'));
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

    if (topologyAssessment.assessment !== 'supported' || !topologyId) {
        return createPartitionedDecision({
            decision,
            topologyAssessment,
            partition: 'unresolved-artifact',
            topologyReason: `No whitelist-supported runtime topology was selected for ${decision.fileName}; artifact partitioning stays unresolved.`
        });
    }

    if (isConnectorLayerArtifact(decision, topologyAssessment.connectorLayer)) {
        return createPartitionedDecision({
            decision,
            topologyAssessment,
            partition: 'connector-layer-artifact',
            topologyReason: `Included ${decision.fileName} as connector-layer artifact for runtime topology ${topologyId}.`
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

    if (loader === baseLoader) {
        return createPartitionedDecision({
            decision,
            topologyAssessment,
            partition: 'target-runtime-artifact',
            topologyReason: `Included ${decision.fileName} as base-loader artifact for runtime topology ${topologyId}.`
        });
    }

    if (bridgedEcosystem && loader === bridgedEcosystem) {
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
