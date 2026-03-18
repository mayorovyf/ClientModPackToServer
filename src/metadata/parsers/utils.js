const { createDependencyRecord, dedupeStrings, normalizeDeclaredSide } = require('../descriptor');

function normalizeEntrypoints(entrypoints, loaderOrigin) {
    const result = [];

    if (!entrypoints || typeof entrypoints !== 'object') {
        return result;
    }

    for (const [key, value] of Object.entries(entrypoints)) {
        const values = Array.isArray(value) ? value : [value];

        for (const item of values) {
            if (typeof item === 'string') {
                result.push({
                    loaderOrigin,
                    key,
                    value: item,
                    adapter: null
                });
                continue;
            }

            if (item && typeof item === 'object') {
                result.push({
                    loaderOrigin,
                    key,
                    value: item.value || item.adapter || item.class || null,
                    adapter: item.adapter || null
                });
            }
        }
    }

    return result;
}

function normalizeMixinConfigs(mixins) {
    if (!Array.isArray(mixins)) {
        return [];
    }

    return dedupeStrings(
        mixins.map((item) => {
            if (typeof item === 'string') {
                return item;
            }

            if (item && typeof item === 'object') {
                return item.config || item.name || null;
            }

            return null;
        })
    );
}

function normalizeFabricDependencyMap(dependencies, kind, loaderOrigin) {
    if (!dependencies || typeof dependencies !== 'object') {
        return [];
    }

    return Object.entries(dependencies)
        .map(([modId, versionRange]) =>
            createDependencyRecord({
                modId,
                kind,
                required: kind === 'depends',
                versionRange: Array.isArray(versionRange) ? versionRange.join(', ') : versionRange,
                loaderOrigin
            })
        )
        .filter((item) => item.modId);
}

function extractDependencyId(value) {
    if (!value) {
        return null;
    }

    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'object') {
        return value.id || value.modId || value.value || null;
    }

    return null;
}

function normalizeDependencyList(values, kind, loaderOrigin, required) {
    if (!values) {
        return [];
    }

    const items = Array.isArray(values) ? values : [values];

    return items
        .map((value) => {
            const modId = extractDependencyId(value);
            const versionRange = typeof value === 'object' ? value.version || value.versions || value.versionRange || null : null;
            const sideHint = typeof value === 'object' ? value.side || value.environment || null : null;

            return createDependencyRecord({
                modId,
                kind,
                required,
                versionRange: Array.isArray(versionRange) ? versionRange.join(', ') : versionRange,
                loaderOrigin,
                sideHint
            });
        })
        .filter((item) => item.modId);
}

function normalizeTomlDependencies(dependencies = {}, loaderOrigin) {
    const required = [];
    const optional = [];
    const incompatibilities = [];

    for (const dependencyList of Object.values(dependencies)) {
        const items = Array.isArray(dependencyList) ? dependencyList : [];

        for (const item of items) {
            const record = createDependencyRecord({
                modId: item.modId || item.id,
                kind: item.mandatory === false ? 'recommends' : 'depends',
                required: item.mandatory !== false,
                versionRange: item.versionRange || null,
                loaderOrigin,
                sideHint: item.side || null
            });

            if (!record.modId) {
                continue;
            }

            if (String(item.type || '').toLowerCase() === 'incompatibility') {
                incompatibilities.push(record);
                continue;
            }

            if (record.required) {
                required.push(record);
            } else {
                optional.push(record);
            }
        }
    }

    return {
        dependencies: required,
        optionalDependencies: optional,
        incompatibilities
    };
}

function normalizeProvides(values) {
    if (!values) {
        return [];
    }

    if (Array.isArray(values)) {
        return dedupeStrings(
            values.map((item) => {
                if (typeof item === 'string') {
                    return item;
                }

                if (item && typeof item === 'object') {
                    return item.id || item.modId || item.value || null;
                }

                return null;
            })
        );
    }

    return dedupeStrings([values]);
}

function chooseDeclaredSide(...values) {
    for (const value of values) {
        const normalized = normalizeDeclaredSide(value);

        if (normalized !== 'unknown') {
            return normalized;
        }
    }

    return 'unknown';
}

module.exports = {
    chooseDeclaredSide,
    normalizeDependencyList,
    normalizeEntrypoints,
    normalizeFabricDependencyMap,
    normalizeMixinConfigs,
    normalizeProvides,
    normalizeTomlDependencies
};
