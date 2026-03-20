const {
    SUPPORTED_MANAGED_SERVER_ENTRYPOINT_KINDS,
    SUPPORTED_VALIDATION_ENTRYPOINT_KINDS
} = require('../policy/constants');

import type { TopologyWhitelistEntry } from '../types/topology';

const RUNTIME_TOPOLOGY_WHITELIST: TopologyWhitelistEntry[] = [
    {
        topologyId: 'fabric-single-loader',
        summary: 'Standard single-loader Fabric runtime.',
        supportLevel: 'supported',
        topologyClass: 'single-loader',
        baseLoader: 'fabric',
        connectorLayer: null,
        bridgedEcosystem: null,
        allowedCoreTypes: ['fabric'],
        allowedValidationEntrypointKinds: [...SUPPORTED_VALIDATION_ENTRYPOINT_KINDS],
        allowedManagedEntrypointKinds: [...SUPPORTED_MANAGED_SERVER_ENTRYPOINT_KINDS],
        allowedJavaProfiles: ['auto', 'java-17', 'java-21'],
        trustedArtifactProvenance: ['source-instance', 'explicit-validation-entrypoint', 'managed-server-installer']
    },
    {
        topologyId: 'quilt-single-loader',
        summary: 'Standard single-loader Quilt runtime.',
        supportLevel: 'supported',
        topologyClass: 'single-loader',
        baseLoader: 'quilt',
        connectorLayer: null,
        bridgedEcosystem: null,
        allowedCoreTypes: [],
        allowedValidationEntrypointKinds: [...SUPPORTED_VALIDATION_ENTRYPOINT_KINDS],
        allowedManagedEntrypointKinds: [...SUPPORTED_MANAGED_SERVER_ENTRYPOINT_KINDS],
        allowedJavaProfiles: ['auto', 'java-17', 'java-21'],
        trustedArtifactProvenance: ['source-instance', 'explicit-validation-entrypoint']
    },
    {
        topologyId: 'forge-single-loader',
        summary: 'Standard single-loader Forge runtime.',
        supportLevel: 'supported',
        topologyClass: 'single-loader',
        baseLoader: 'forge',
        connectorLayer: null,
        bridgedEcosystem: null,
        allowedCoreTypes: ['forge'],
        allowedValidationEntrypointKinds: [...SUPPORTED_VALIDATION_ENTRYPOINT_KINDS],
        allowedManagedEntrypointKinds: [...SUPPORTED_MANAGED_SERVER_ENTRYPOINT_KINDS],
        allowedJavaProfiles: ['auto', 'java-17'],
        trustedArtifactProvenance: ['source-instance', 'explicit-validation-entrypoint', 'managed-server-installer']
    },
    {
        topologyId: 'neoforge-single-loader',
        summary: 'Standard single-loader NeoForge runtime.',
        supportLevel: 'supported',
        topologyClass: 'single-loader',
        baseLoader: 'neoforge',
        connectorLayer: null,
        bridgedEcosystem: null,
        allowedCoreTypes: ['neoforge'],
        allowedValidationEntrypointKinds: [...SUPPORTED_VALIDATION_ENTRYPOINT_KINDS],
        allowedManagedEntrypointKinds: [...SUPPORTED_MANAGED_SERVER_ENTRYPOINT_KINDS],
        allowedJavaProfiles: ['auto', 'java-17', 'java-21'],
        trustedArtifactProvenance: ['source-instance', 'explicit-validation-entrypoint', 'managed-server-installer']
    },
    {
        topologyId: 'neoforge-sinytra-fabric-bridge',
        summary: 'NeoForge base runtime with Sinytra Connector bridging Fabric artifacts.',
        supportLevel: 'pending',
        topologyClass: 'connector-based',
        baseLoader: 'neoforge',
        connectorLayer: 'sinytra-connector',
        bridgedEcosystem: 'fabric',
        allowedCoreTypes: ['neoforge'],
        allowedValidationEntrypointKinds: [...SUPPORTED_VALIDATION_ENTRYPOINT_KINDS],
        allowedManagedEntrypointKinds: [...SUPPORTED_MANAGED_SERVER_ENTRYPOINT_KINDS],
        allowedJavaProfiles: ['auto', 'java-21'],
        trustedArtifactProvenance: ['source-instance', 'explicit-validation-entrypoint', 'managed-server-installer']
    }
];

function cloneTopologyWhitelistEntry(entry: TopologyWhitelistEntry): TopologyWhitelistEntry {
    return {
        ...entry,
        allowedCoreTypes: [...entry.allowedCoreTypes],
        allowedValidationEntrypointKinds: [...entry.allowedValidationEntrypointKinds],
        allowedManagedEntrypointKinds: [...entry.allowedManagedEntrypointKinds],
        allowedJavaProfiles: [...entry.allowedJavaProfiles],
        trustedArtifactProvenance: [...entry.trustedArtifactProvenance]
    };
}

export function getRuntimeTopologyWhitelist(): TopologyWhitelistEntry[] {
    return RUNTIME_TOPOLOGY_WHITELIST.map((entry) => cloneTopologyWhitelistEntry(entry));
}

export function findRuntimeTopologyWhitelistEntry(topologyId: TopologyWhitelistEntry['topologyId']): TopologyWhitelistEntry | null {
    const matchedEntry = RUNTIME_TOPOLOGY_WHITELIST.find((entry) => entry.topologyId === topologyId);
    return matchedEntry ? cloneTopologyWhitelistEntry(matchedEntry) : null;
}

export function listSupportedRuntimeTopologyIds(): TopologyWhitelistEntry['topologyId'][] {
    return RUNTIME_TOPOLOGY_WHITELIST
        .filter((entry) => entry.supportLevel === 'supported')
        .map((entry) => entry.topologyId);
}

export function listPendingRuntimeTopologyIds(): TopologyWhitelistEntry['topologyId'][] {
    return RUNTIME_TOPOLOGY_WHITELIST
        .filter((entry) => entry.supportLevel === 'pending')
        .map((entry) => entry.topologyId);
}

module.exports = {
    findRuntimeTopologyWhitelistEntry,
    getRuntimeTopologyWhitelist,
    listPendingRuntimeTopologyIds,
    listSupportedRuntimeTopologyIds
};
