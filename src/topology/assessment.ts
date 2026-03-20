const { evaluateTrustPolicyAction } = require('../policy/trust-policy');
const {
    findRuntimeTopologyWhitelistEntry,
    listPendingRuntimeTopologyIds,
    listSupportedRuntimeTopologyIds
} = require('./whitelist');

import type { PackRuntimeDetection } from '../types/runtime-detection';
import type { LoaderKind } from '../types/metadata';
import type { RuntimeTopologyAssessment, RuntimeTopologyId, TrustedArtifactProvenance } from '../types/topology';
import type { RunContext } from '../types/run';

interface DecisionLike {
    fileName?: string | null;
    descriptor?: {
        loader?: LoaderKind | 'unknown';
        modIds?: string[] | null;
        displayName?: string | null;
        manifestHints?: Record<string, string> | null;
    } | null;
}

function toSortedUniqueList(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function normalizeString(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null;
    }

    const normalized = String(value).trim();
    return normalized ? normalized : null;
}

function collectDetectedLoaders(decisions: DecisionLike[], runtimeDetection: PackRuntimeDetection | null): LoaderKind[] {
    const detectedLoaders = new Set<LoaderKind>();

    for (const decision of decisions) {
        const loader = decision?.descriptor?.loader;

        if (loader && loader !== 'unknown') {
            detectedLoaders.add(loader);
        }
    }

    if (runtimeDetection?.loader && runtimeDetection.loader !== 'unknown') {
        detectedLoaders.add(runtimeDetection.loader);
    }

    return [...detectedLoaders].sort((left, right) => left.localeCompare(right));
}

function collectHintTokens(decisions: DecisionLike[]): string[] {
    const tokens: string[] = [];

    for (const decision of decisions) {
        const fileName = normalizeString(decision?.fileName);
        const descriptor = decision?.descriptor;

        if (fileName) {
            tokens.push(fileName.toLowerCase());
        }

        for (const modId of descriptor?.modIds || []) {
            const normalizedModId = normalizeString(modId);

            if (normalizedModId) {
                tokens.push(normalizedModId.toLowerCase());
            }
        }

        const displayName = normalizeString(descriptor?.displayName);

        if (displayName) {
            tokens.push(displayName.toLowerCase());
        }

        for (const value of Object.values(descriptor?.manifestHints || {})) {
            const normalizedHint = normalizeString(value);

            if (normalizedHint) {
                tokens.push(normalizedHint.toLowerCase());
            }
        }
    }

    return toSortedUniqueList(tokens);
}

function collectTrustedArtifactProvenance(runContext: RunContext): TrustedArtifactProvenance[] {
    const provenance = new Set<TrustedArtifactProvenance>(['source-instance']);

    if (runContext.validationEntrypointPath) {
        provenance.add('explicit-validation-entrypoint');
    }

    if (runContext.installServerCore) {
        provenance.add('managed-server-installer');
    }

    return [...provenance].sort((left, right) => left.localeCompare(right));
}

function detectConnectorLayer(tokens: string[]) {
    const connectorHints: string[] = [];
    let connectorLayer: RuntimeTopologyAssessment['connectorLayer'] = null;

    for (const token of tokens) {
        if (/sinytra/.test(token) && /connector/.test(token)) {
            connectorLayer = 'sinytra-connector';
            connectorHints.push('sinytra-connector');
            continue;
        }

        if (/connector/.test(token) || /bridge/.test(token)) {
            if (!connectorLayer) {
                connectorLayer = 'unknown-connector-layer';
            }

            connectorHints.push(token);
        }
    }

    return {
        connectorLayer,
        connectorHints: toSortedUniqueList(connectorHints)
    };
}

function detectBridgedEcosystem({
    detectedLoaders,
    tokens
}: {
    detectedLoaders: LoaderKind[];
    tokens: string[];
}): RuntimeTopologyAssessment['bridgedEcosystem'] {
    if (detectedLoaders.includes('fabric')) {
        return 'fabric';
    }

    if (detectedLoaders.includes('quilt')) {
        return 'quilt';
    }

    if (tokens.some((token) => token.includes('fabric'))) {
        return 'fabric';
    }

    if (tokens.some((token) => token.includes('quilt'))) {
        return 'quilt';
    }

    if (detectedLoaders.includes('forge')) {
        return 'forge';
    }

    if (detectedLoaders.includes('neoforge')) {
        return 'neoforge';
    }

    return null;
}

function inferBaseLoader({
    detectedLoaders,
    connectorLayer
}: {
    detectedLoaders: LoaderKind[];
    connectorLayer: RuntimeTopologyAssessment['connectorLayer'];
}): LoaderKind | null {
    if (detectedLoaders.length === 1) {
        return detectedLoaders[0] || null;
    }

    if (connectorLayer === 'sinytra-connector' && detectedLoaders.includes('neoforge')) {
        return 'neoforge';
    }

    if (detectedLoaders.includes('neoforge')) {
        return 'neoforge';
    }

    if (detectedLoaders.includes('forge')) {
        return 'forge';
    }

    return null;
}

function resolveTopologyId({
    detectedLoaders,
    baseLoader,
    connectorLayer,
    bridgedEcosystem
}: {
    detectedLoaders: LoaderKind[];
    baseLoader: LoaderKind | null;
    connectorLayer: RuntimeTopologyAssessment['connectorLayer'];
    bridgedEcosystem: RuntimeTopologyAssessment['bridgedEcosystem'];
}): RuntimeTopologyId | null {
    if (!connectorLayer && detectedLoaders.length === 1 && baseLoader) {
        switch (baseLoader) {
            case 'fabric':
                return 'fabric-single-loader';
            case 'quilt':
                return 'quilt-single-loader';
            case 'forge':
                return 'forge-single-loader';
            case 'neoforge':
                return 'neoforge-single-loader';
            default:
                return null;
        }
    }

    if (connectorLayer === 'sinytra-connector' && baseLoader === 'neoforge' && bridgedEcosystem === 'fabric') {
        return 'neoforge-sinytra-fabric-bridge';
    }

    return null;
}

function buildPendingAssessment({
    supportedTopologyIds,
    pendingTopologyIds,
    trustedArtifactProvenance
}: {
    supportedTopologyIds: RuntimeTopologyAssessment['supportedTopologyIds'];
    pendingTopologyIds: RuntimeTopologyAssessment['pendingTopologyIds'];
    trustedArtifactProvenance: RuntimeTopologyAssessment['trustedArtifactProvenance'];
}): RuntimeTopologyAssessment {
    return {
        status: 'pending',
        assessment: 'pending',
        code: 'RUNTIME_TOPOLOGY_PENDING',
        summary: 'Runtime topology will be resolved after static analysis.',
        topologyId: null,
        topologyClass: 'unresolved',
        baseLoader: null,
        connectorLayer: null,
        bridgedEcosystem: null,
        detectedLoaders: [],
        detectedConnectorHints: [],
        matchedWhitelistEntry: null,
        supportedTopologyIds,
        pendingTopologyIds,
        trustedArtifactProvenance,
        policyBlockedReason: null
    };
}

function buildUnsupportedAssessment({
    code,
    summary,
    topologyClass,
    baseLoader,
    connectorLayer,
    bridgedEcosystem,
    detectedLoaders,
    detectedConnectorHints,
    supportedTopologyIds,
    pendingTopologyIds,
    trustedArtifactProvenance,
    policyBlockedReason = null
}: {
    code: string;
    summary: string;
    topologyClass: RuntimeTopologyAssessment['topologyClass'];
    baseLoader: LoaderKind | null;
    connectorLayer: RuntimeTopologyAssessment['connectorLayer'];
    bridgedEcosystem: RuntimeTopologyAssessment['bridgedEcosystem'];
    detectedLoaders: LoaderKind[];
    detectedConnectorHints: string[];
    supportedTopologyIds: RuntimeTopologyAssessment['supportedTopologyIds'];
    pendingTopologyIds: RuntimeTopologyAssessment['pendingTopologyIds'];
    trustedArtifactProvenance: RuntimeTopologyAssessment['trustedArtifactProvenance'];
    policyBlockedReason?: string | null;
}): RuntimeTopologyAssessment {
    return {
        status: 'unsupported',
        assessment: policyBlockedReason ? 'blocked-by-trust-policy' : 'unsupported',
        code,
        summary,
        topologyId: null,
        topologyClass,
        baseLoader,
        connectorLayer,
        bridgedEcosystem,
        detectedLoaders,
        detectedConnectorHints,
        matchedWhitelistEntry: null,
        supportedTopologyIds,
        pendingTopologyIds,
        trustedArtifactProvenance,
        policyBlockedReason
    };
}

export function assessRuntimeTopology({
    runContext,
    decisions = null,
    runtimeDetection = null,
    isFinal = false
}: {
    runContext: RunContext;
    decisions?: DecisionLike[] | null;
    runtimeDetection?: PackRuntimeDetection | null;
    isFinal?: boolean;
}): RuntimeTopologyAssessment {
    const supportedTopologyIds = listSupportedRuntimeTopologyIds();
    const pendingTopologyIds = listPendingRuntimeTopologyIds();
    const trustedArtifactProvenance = collectTrustedArtifactProvenance(runContext);

    if (!Array.isArray(decisions)) {
        return buildPendingAssessment({
            supportedTopologyIds,
            pendingTopologyIds,
            trustedArtifactProvenance
        });
    }

    const detectedLoaders = collectDetectedLoaders(decisions, runtimeDetection);
    const tokens = collectHintTokens(decisions);
    const { connectorLayer, connectorHints } = detectConnectorLayer(tokens);
    const bridgedEcosystem = detectBridgedEcosystem({
        detectedLoaders,
        tokens
    });
    const baseLoader = inferBaseLoader({
        detectedLoaders,
        connectorLayer
    });
    const topologyId = resolveTopologyId({
        detectedLoaders,
        baseLoader,
        connectorLayer,
        bridgedEcosystem
    });
    const matchedWhitelistEntry = topologyId ? findRuntimeTopologyWhitelistEntry(topologyId) : null;

    if (matchedWhitelistEntry) {
        if (matchedWhitelistEntry.supportLevel === 'supported') {
            return {
                status: 'supported',
                assessment: 'supported',
                code: 'RUNTIME_TOPOLOGY_SUPPORTED',
                summary: `Resolved whitelist-supported runtime topology ${matchedWhitelistEntry.topologyId}.`,
                topologyId: matchedWhitelistEntry.topologyId,
                topologyClass: matchedWhitelistEntry.topologyClass,
                baseLoader: matchedWhitelistEntry.baseLoader,
                connectorLayer: matchedWhitelistEntry.connectorLayer,
                bridgedEcosystem: matchedWhitelistEntry.bridgedEcosystem,
                detectedLoaders,
                detectedConnectorHints: connectorHints,
                matchedWhitelistEntry,
                supportedTopologyIds,
                pendingTopologyIds,
                trustedArtifactProvenance,
                policyBlockedReason: null
            };
        }

        return {
            status: isFinal ? 'unsupported' : 'pending',
            assessment: 'pending',
            code: 'RUNTIME_TOPOLOGY_PENDING_WHITELIST_ENTRY',
            summary: `Runtime topology ${matchedWhitelistEntry.topologyId} is recognized by the whitelist, but it is still pending automation.`,
            topologyId: matchedWhitelistEntry.topologyId,
            topologyClass: matchedWhitelistEntry.topologyClass,
            baseLoader: matchedWhitelistEntry.baseLoader,
            connectorLayer: matchedWhitelistEntry.connectorLayer,
            bridgedEcosystem: matchedWhitelistEntry.bridgedEcosystem,
            detectedLoaders,
            detectedConnectorHints: connectorHints,
            matchedWhitelistEntry,
            supportedTopologyIds,
            pendingTopologyIds,
            trustedArtifactProvenance,
            policyBlockedReason: null
        };
    }

    if (detectedLoaders.length === 0) {
        return isFinal
            ? buildUnsupportedAssessment({
                code: 'RUNTIME_TOPOLOGY_UNRESOLVED',
                summary: 'Static analysis could not resolve the runtime topology into a whitelist entry.',
                topologyClass: 'unresolved',
                baseLoader,
                connectorLayer,
                bridgedEcosystem,
                detectedLoaders,
                detectedConnectorHints: connectorHints,
                supportedTopologyIds,
                pendingTopologyIds,
                trustedArtifactProvenance
            })
            : buildPendingAssessment({
                supportedTopologyIds,
                pendingTopologyIds,
                trustedArtifactProvenance
            });
    }

    if (connectorLayer) {
        const blockedAction = evaluateTrustPolicyAction('connector-specific-risky-fix');
        const blockedReason = blockedAction.denialReason
            || 'No whitelist-supported connector topology can be selected without a trust-policy-blocked connector-specific fix.';

        return buildUnsupportedAssessment({
            code: 'RUNTIME_TOPOLOGY_BLOCKED_BY_TRUST_POLICY',
            summary: `Connector hints were detected (${connectorHints.join(', ') || connectorLayer}), but no trusted whitelist entry matched them.`,
            topologyClass: 'connector-based',
            baseLoader,
            connectorLayer,
            bridgedEcosystem,
            detectedLoaders,
            detectedConnectorHints: connectorHints,
            supportedTopologyIds,
            pendingTopologyIds,
            trustedArtifactProvenance,
            policyBlockedReason: blockedReason
        });
    }

    if (detectedLoaders.length > 1) {
        return buildUnsupportedAssessment({
            code: 'MIXED_ARTIFACT_SET_UNSUPPORTED',
            summary: `Detected mixed artifact set with loaders ${detectedLoaders.join(', ')} and no trusted topology resolution path.`,
            topologyClass: 'mixed-artifact-set',
            baseLoader,
            connectorLayer,
            bridgedEcosystem,
            detectedLoaders,
            detectedConnectorHints: connectorHints,
            supportedTopologyIds,
            pendingTopologyIds,
            trustedArtifactProvenance
        });
    }

    return buildUnsupportedAssessment({
        code: 'RUNTIME_TOPOLOGY_OUTSIDE_WHITELIST',
        summary: `Resolved loader ${detectedLoaders[0]} does not map to a whitelist-supported runtime topology.`,
        topologyClass: 'unresolved',
        baseLoader,
        connectorLayer,
        bridgedEcosystem,
        detectedLoaders,
        detectedConnectorHints: connectorHints,
        supportedTopologyIds,
        pendingTopologyIds,
        trustedArtifactProvenance
    });
}

module.exports = {
    assessRuntimeTopology
};
