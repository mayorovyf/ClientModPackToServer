import type { LoaderKind } from '../types/metadata';
import type { ConnectorLayerId } from '../types/topology';

interface TopologyDecisionLike {
    fileName?: string | null;
    descriptor?: {
        loader?: LoaderKind | 'unknown';
        modIds?: string[] | null;
        displayName?: string | null;
        metadataFilesFound?: string[] | null;
    } | null;
}

function normalizeString(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null;
    }

    const normalized = String(value).trim();
    return normalized ? normalized : null;
}

function normalizeIdentityText(value: string): string {
    return value
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .toLowerCase();
}

function listIdentitySignals(decision: TopologyDecisionLike): Array<{ raw: string; normalized: string }> {
    const values: string[] = [];
    const fileName = normalizeString(decision.fileName);
    const displayName = normalizeString(decision.descriptor?.displayName);

    if (fileName) {
        values.push(fileName);
    }

    if (displayName) {
        values.push(displayName);
    }

    for (const modId of decision.descriptor?.modIds || []) {
        const normalizedModId = normalizeString(modId);

        if (normalizedModId) {
            values.push(normalizedModId);
        }
    }

    return [...new Set(values)]
        .map((raw) => ({
            raw,
            normalized: normalizeIdentityText(raw)
        }))
        .filter((entry) => entry.normalized.length > 0);
}

function isKnownSinytraConnectorSignal(text: string): boolean {
    return /\bsinytra\b/.test(text) && /\bconnector\b/.test(text)
        || /sinytraconnector/.test(text.replace(/\s+/g, ''));
}

function isGenericConnectorSignal(text: string): boolean {
    return /\bconnector\b/.test(text);
}

function classifyDecisionConnectorSignal(decision: TopologyDecisionLike): {
    connectorLayer: ConnectorLayerId | null;
    hints: string[];
} {
    const identitySignals = listIdentitySignals(decision);
    const knownHints = identitySignals
        .filter((entry) => isKnownSinytraConnectorSignal(entry.normalized))
        .map((entry) => entry.raw.toLowerCase());

    if (knownHints.length > 0) {
        return {
            connectorLayer: 'sinytra-connector',
            hints: [...new Set(knownHints)]
        };
    }

    const genericHints = identitySignals
        .filter((entry) => isGenericConnectorSignal(entry.normalized))
        .map((entry) => entry.raw.toLowerCase());

    if (genericHints.length > 0) {
        return {
            connectorLayer: 'unknown-connector-layer',
            hints: [...new Set(genericHints)]
        };
    }

    return {
        connectorLayer: null,
        hints: []
    };
}

function detectRuntimeConnectorLayer(decisions: TopologyDecisionLike[]): {
    connectorLayer: ConnectorLayerId | null;
    connectorHints: string[];
} {
    const connectorHints = new Set<string>();
    let connectorLayer: ConnectorLayerId | null = null;

    for (const decision of decisions) {
        const classified = classifyDecisionConnectorSignal(decision);

        for (const hint of classified.hints) {
            connectorHints.add(hint);
        }

        if (classified.connectorLayer === 'sinytra-connector') {
            connectorLayer = 'sinytra-connector';
            continue;
        }

        if (!connectorLayer && classified.connectorLayer === 'unknown-connector-layer') {
            connectorLayer = 'unknown-connector-layer';
        }
    }

    return {
        connectorLayer,
        connectorHints: [...connectorHints].sort((left, right) => left.localeCompare(right))
    };
}

function listArtifactCompatibleLoaders(decision: TopologyDecisionLike): LoaderKind[] {
    const compatibleLoaders = new Set<LoaderKind>();
    const loader = decision.descriptor?.loader;

    if (loader && loader !== 'unknown') {
        compatibleLoaders.add(loader);
    }

    const metadataFilesFound = decision.descriptor?.metadataFilesFound || [];

    if (metadataFilesFound.includes('META-INF/mods.toml')) {
        compatibleLoaders.add('forge');
    }

    if (metadataFilesFound.includes('META-INF/neoforge.mods.toml')) {
        compatibleLoaders.add('neoforge');
    }

    if (metadataFilesFound.includes('fabric.mod.json')) {
        compatibleLoaders.add('fabric');
    }

    if (metadataFilesFound.includes('quilt.mod.json')) {
        compatibleLoaders.add('quilt');
    }

    return [...compatibleLoaders].sort((left, right) => left.localeCompare(right));
}

function isKnownConnectorArtifact(decision: TopologyDecisionLike): boolean {
    return classifyDecisionConnectorSignal(decision).connectorLayer === 'sinytra-connector';
}

module.exports = {
    detectRuntimeConnectorLayer,
    isKnownConnectorArtifact,
    listArtifactCompatibleLoaders
};
