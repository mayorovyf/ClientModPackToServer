const { normalizeConfidence } = require('../classification/engine-result');
const { RegistryValidationError } = require('../core/errors');
const { REGISTRY_SCHEMA_VERSION, SUPPORTED_REGISTRY_SCHEMA_VERSIONS } = require('./constants');

import type { LoaderKind } from '../types/metadata';
import type { EffectiveRegistry, RegistryRule, RegistrySide } from '../types/registry';

const ALLOWED_SIDES = new Set<RegistrySide>(['client', 'server', 'both', 'unknown']);
const ALLOWED_LOADERS = new Set<LoaderKind>(['fabric', 'quilt', 'forge', 'neoforge', 'unknown']);

interface RegistrySummary {
    ruleCount: number;
    bySide: Record<RegistrySide, number>;
}

interface RegistrySnapshotOptions {
    schemaVersion?: number | string;
    registryVersion?: string | null;
    generatedAt?: string | null;
    filePath?: string | null;
    exists?: boolean;
    sourceType?: string;
    sourceLabel?: string;
    rules?: RegistryRule[];
    metadata?: Record<string, unknown>;
}

interface NormalizeRuleOptions {
    defaultSource?: string;
    defaultPriority?: number;
    fallbackRuleIdPrefix?: string;
}

interface NormalizeDocumentOptions extends NormalizeRuleOptions {
    filePath?: string | null;
    exists?: boolean;
    sourceType?: string;
    sourceLabel?: string;
    registryVersion?: string | null;
    generatedAt?: string | null;
}

function normalizeStringList(values: unknown[] = []): string[] {
    if (!Array.isArray(values)) {
        return [];
    }

    return [...new Set(values.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean))];
}

function normalizeLoaderList(values: unknown[] = []): LoaderKind[] {
    return normalizeStringList(values)
        .filter((value): value is LoaderKind => ALLOWED_LOADERS.has(value as LoaderKind));
}

function normalizeSchemaVersion(value: unknown): number {
    const normalized = Number(value) || REGISTRY_SCHEMA_VERSION;

    if (!SUPPORTED_REGISTRY_SCHEMA_VERSIONS.includes(normalized)) {
        throw new RegistryValidationError(`Неподдерживаемая версия схемы реестра: ${value}`);
    }

    return normalized;
}

function normalizePriority(value: unknown, fallback = 0): number {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    const normalized = Number(value);

    return Number.isFinite(normalized) ? Math.trunc(normalized) : fallback;
}

function normalizeSide(side: unknown): RegistrySide {
    const normalized = String(side || 'unknown').trim().toLowerCase() as RegistrySide;

    return ALLOWED_SIDES.has(normalized) ? normalized : 'unknown';
}

function computeRegistrySummary(rules: RegistryRule[] = []): RegistrySummary {
    return {
        ruleCount: rules.length,
        bySide: {
            client: rules.filter((rule) => rule.side === 'client').length,
            server: rules.filter((rule) => rule.side === 'server').length,
            both: rules.filter((rule) => rule.side === 'both').length,
            unknown: rules.filter((rule) => rule.side === 'unknown').length
        }
    };
}

function createRegistrySnapshot({
    schemaVersion = REGISTRY_SCHEMA_VERSION,
    registryVersion = 'unversioned',
    generatedAt = null,
    filePath = null,
    exists = false,
    sourceType = 'registry',
    sourceLabel = 'registry',
    rules = [],
    metadata = {}
}: RegistrySnapshotOptions = {}): EffectiveRegistry {
    return {
        schemaVersion: normalizeSchemaVersion(schemaVersion),
        registryVersion: String(registryVersion || 'unversioned').trim() || 'unversioned',
        generatedAt: generatedAt ? String(generatedAt) : null,
        filePath,
        exists: Boolean(exists),
        sourceType: String(sourceType || 'registry'),
        sourceLabel: String(sourceLabel || 'registry'),
        rules,
        summary: computeRegistrySummary(rules),
        metadata
    };
}

function createEmptyRegistry(filePath: string | null = null, extra: RegistrySnapshotOptions = {}): EffectiveRegistry {
    return createRegistrySnapshot({
        filePath,
        exists: false,
        sourceType: extra.sourceType || 'empty',
        sourceLabel: extra.sourceLabel || 'empty-registry',
        registryVersion: extra.registryVersion || 'empty',
        generatedAt: extra.generatedAt || null,
        metadata: extra.metadata || {}
    });
}

function normalizeRegistryRule(rule: Record<string, unknown>, index: number, {
    defaultSource = 'registry',
    defaultPriority = 0,
    fallbackRuleIdPrefix = 'rule'
}: NormalizeRuleOptions = {}): RegistryRule {
    const modIds = normalizeStringList(rule.modIds as unknown[]);
    const aliases = normalizeStringList(rule.aliases as unknown[]);
    const fileNames = normalizeStringList(rule.fileNames as unknown[]);
    const loaders = normalizeLoaderList(rule.loaders as unknown[]);

    if (modIds.length === 0 && aliases.length === 0 && fileNames.length === 0) {
        throw new RegistryValidationError(`Правило реестра #${index + 1} не содержит ни одного идентификатора сопоставления`);
    }

    return {
        ruleId: String(rule.ruleId || `${fallbackRuleIdPrefix}-${index + 1}`).trim(),
        side: normalizeSide(rule.side),
        confidence: normalizeConfidence(rule.confidence),
        reason: String(rule.reason || 'Registry rule').trim(),
        source: String(rule.source || defaultSource).trim(),
        modIds,
        aliases,
        fileNames,
        loaders,
        priority: normalizePriority(rule.priority, defaultPriority),
        updatedAt: rule.updatedAt ? String(rule.updatedAt).trim() : null,
        notes: rule.notes ? String(rule.notes).trim() : null
    };
}

function normalizeRegistryDocument(parsed: unknown, {
    filePath = null,
    exists = true,
    defaultSource = 'registry',
    defaultPriority = 0,
    sourceType = 'registry',
    sourceLabel = defaultSource,
    registryVersion = null,
    generatedAt = null
}: NormalizeDocumentOptions = {}): EffectiveRegistry {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new RegistryValidationError('Некорректный формат registry JSON: ожидается объект');
    }

    const normalizedDocument = parsed as Record<string, unknown>;
    const rules = Array.isArray(normalizedDocument.rules)
        ? normalizedDocument.rules.map((rule, index) => normalizeRegistryRule(rule as Record<string, unknown>, index, {
            defaultSource,
            defaultPriority
        }))
        : [];

    const schemaVersion = normalizedDocument.schemaVersion;

    return createRegistrySnapshot({
        ...(schemaVersion !== undefined ? { schemaVersion: schemaVersion as number | string } : {}),
        registryVersion: String(normalizedDocument.registryVersion || registryVersion || 'unversioned'),
        generatedAt: normalizedDocument.generatedAt ? String(normalizedDocument.generatedAt) : generatedAt,
        filePath,
        exists,
        sourceType,
        sourceLabel,
        rules,
        metadata: {
            source: normalizedDocument.source || null,
            summary: normalizedDocument.summary || null
        }
    });
}

module.exports = {
    computeRegistrySummary,
    createEmptyRegistry,
    createRegistrySnapshot,
    normalizeLoaderList,
    normalizePriority,
    normalizeRegistryDocument,
    normalizeRegistryRule,
    normalizeSchemaVersion,
    normalizeStringList
};
