const { dedupeStrings } = require('../metadata/descriptor');

function collectProvidedIds(descriptor = {}) {
    return dedupeStrings([...(descriptor.modIds || []), ...(descriptor.provides || [])]);
}

function buildProviderIndex(decisions = []) {
    const byId = {};
    const providerEntries = [];
    let multiModJarCount = 0;

    for (const decision of decisions) {
        const descriptor = decision.descriptor;

        if (!descriptor) {
            continue;
        }

        const providedIds = collectProvidedIds(descriptor);

        if ((descriptor.modIds || []).length > 1) {
            multiModJarCount += 1;
        }

        for (const providedId of providedIds) {
            const provider = {
                providedId,
                fileName: decision.fileName,
                sourcePath: decision.sourcePath,
                loader: descriptor.loader,
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

function lookupProviders(providerIndex, modId) {
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
