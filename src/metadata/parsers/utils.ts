const { createDependencyRecord, dedupeStrings, normalizeDeclaredSide } = require('../descriptor');

import type {
    DependencyDescriptor,
    EntrypointDescriptor,
    LoaderKind,
    SideHint
} from '../../types/metadata';

interface NormalizedTomlDependencies {
    dependencies: DependencyDescriptor[];
    optionalDependencies: DependencyDescriptor[];
    incompatibilities: DependencyDescriptor[];
}

function normalizeEntrypoints(entrypoints: unknown, loaderOrigin: LoaderKind): EntrypointDescriptor[] {
    const result: EntrypointDescriptor[] = [];

    if (!entrypoints || typeof entrypoints !== 'object') {
        return result;
    }

    for (const [key, value] of Object.entries(entrypoints as Record<string, unknown>)) {
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
                const entry = item as Record<string, unknown>;

                result.push({
                    loaderOrigin,
                    key,
                    value: entry.value ? String(entry.value) : entry.adapter ? String(entry.adapter) : entry.class ? String(entry.class) : null,
                    adapter: entry.adapter ? String(entry.adapter) : null
                });
            }
        }
    }

    return result;
}

function normalizeMixinConfigs(mixins: unknown): string[] {
    if (!Array.isArray(mixins)) {
        return [];
    }

    return dedupeStrings(
        mixins.map((item) => {
            if (typeof item === 'string') {
                return item;
            }

            if (item && typeof item === 'object') {
                const objectItem = item as Record<string, unknown>;
                return objectItem.config || objectItem.name || null;
            }

            return null;
        })
    );
}

function normalizeFabricDependencyMap(
    dependencies: unknown,
    kind: string,
    loaderOrigin: LoaderKind
): DependencyDescriptor[] {
    if (!dependencies || typeof dependencies !== 'object') {
        return [];
    }

    return Object.entries(dependencies as Record<string, unknown>)
        .map(([modId, versionRange]) =>
            createDependencyRecord({
                modId,
                kind,
                required: kind === 'depends',
                versionRange: Array.isArray(versionRange) ? versionRange.join(', ') : versionRange,
                loaderOrigin
            })
        )
        .filter((item: DependencyDescriptor) => item.modId);
}

function extractDependencyId(value: unknown): string | null {
    if (!value) {
        return null;
    }

    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'object') {
        const objectValue = value as Record<string, unknown>;
        return objectValue.id ? String(objectValue.id) : objectValue.modId ? String(objectValue.modId) : objectValue.value ? String(objectValue.value) : null;
    }

    return null;
}

function normalizeDependencyList(
    values: unknown,
    kind: string,
    loaderOrigin: LoaderKind,
    required: boolean
): DependencyDescriptor[] {
    if (!values) {
        return [];
    }

    const items = Array.isArray(values) ? values : [values];

    return items
        .map((value) => {
            const objectValue = typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
            const modId = extractDependencyId(value);
            const versionRange = objectValue ? objectValue.version || objectValue.versions || objectValue.versionRange || null : null;
            const sideHint = objectValue ? objectValue.side || objectValue.environment || null : null;

            return createDependencyRecord({
                modId,
                kind,
                required,
                versionRange: Array.isArray(versionRange) ? versionRange.join(', ') : versionRange,
                loaderOrigin,
                sideHint
            });
        })
        .filter((item: DependencyDescriptor) => item.modId);
}

function normalizeTomlDependencies(dependencies: Record<string, unknown> = {}, loaderOrigin: LoaderKind): NormalizedTomlDependencies {
    const required: DependencyDescriptor[] = [];
    const optional: DependencyDescriptor[] = [];
    const incompatibilities: DependencyDescriptor[] = [];

    for (const dependencyList of Object.values(dependencies)) {
        const items = Array.isArray(dependencyList) ? dependencyList : [];

        for (const item of items) {
            if (!item || typeof item !== 'object') {
                continue;
            }

            const recordItem = item as Record<string, unknown>;
            const record = createDependencyRecord({
                modId: recordItem.modId || recordItem.id,
                kind: recordItem.mandatory === false ? 'recommends' : 'depends',
                required: recordItem.mandatory !== false,
                versionRange: recordItem.versionRange || null,
                loaderOrigin,
                sideHint: recordItem.side || null
            });

            if (!record.modId) {
                continue;
            }

            if (String(recordItem.type || '').toLowerCase() === 'incompatibility') {
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

function normalizeProvides(values: unknown): string[] {
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
                    const objectItem = item as Record<string, unknown>;
                    return objectItem.id || objectItem.modId || objectItem.value || null;
                }

                return null;
            })
        );
    }

    return dedupeStrings([values]);
}

function chooseDeclaredSide(...values: unknown[]): SideHint {
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
