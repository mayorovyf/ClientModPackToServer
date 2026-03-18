const { dedupeStrings } = require('../metadata/descriptor');

import type { DependencyProviderEntry, DependencyProviderIndex } from '../types/dependency';
import type { ModDescriptor } from '../types/descriptor';

function collectProvidedIds(descriptor: Partial<ModDescriptor> = {}): string[] {
    return dedupeStrings([...(descriptor.modIds || []), ...(descriptor.provides || [])]);
}

function buildProviderIndex(decisions: Array<Record<string, any>> = []): DependencyProviderIndex {
    const byId: Record<string, DependencyProviderEntry[]> = {};
    const providerEntries: DependencyProviderEntry[] = [];
    let multiModJarCount = 0;

    for (const decision of decisions) {
        const descriptor = decision.descriptor as Partial<ModDescriptor> | null;

        if (!descriptor) {
            continue;
        }

        const providedIds = collectProvidedIds(descriptor);

        if ((descriptor.modIds || []).length > 1) {
            multiModJarCount += 1;
        }

        for (const providedId of providedIds) {
            const provider: DependencyProviderEntry = {
                providedId,
                fileName: decision.fileName,
                sourcePath: decision.sourcePath,
                loader: descriptor.loader || 'unknown',
                modIds: [...(descriptor.modIds || [])],
                provides: [...(descriptor.provides || [])],
                currentDecision: decision.decision
            };

            if (!byId[providedId]) {
                byId[providedId] = [];
            }

            byId[providedId].push(provider);
            providerEntries.push(provider);
        }
    }

    const ambiguousIds = Object.entries(byId)
        .filter(([, providers]) => providers.length > 1)
        .map(([providedId]) => providedId)
        .sort();

    return {
        byId,
        providerEntries,
        summary: {
            uniqueProvidedIds: Object.keys(byId).length,
            providerEntries: providerEntries.length,
            ambiguousIds,
            ambiguousIdsCount: ambiguousIds.length,
            multiModJarCount
        }
    };
}

function lookupProviders(providerIndex: DependencyProviderIndex | null | undefined, modId: string | null | undefined): DependencyProviderEntry[] {
    if (!providerIndex || !providerIndex.byId || !modId) {
        return [];
    }

    return providerIndex.byId[modId] ? [...providerIndex.byId[modId]] : [];
}

module.exports = {
    buildProviderIndex,
    collectProvidedIds,
    lookupProviders
};
