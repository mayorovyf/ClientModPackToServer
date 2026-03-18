const { normalizeConfidence } = require('../classification/engine-result');
const { RegistryValidationError } = require('../core/errors');
const { REGISTRY_SCHEMA_VERSION, SUPPORTED_REGISTRY_SCHEMA_VERSIONS } = require('./constants');

const ALLOWED_SIDES = new Set(['client', 'server', 'both', 'unknown']);

function normalizeStringList(values = []) {
    if (!Array.isArray(values)) {
        return [];
    }

    return [...new Set(values.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean))];
}

function normalizeSchemaVersion(value) {
    const normalized = Number(value) || REGISTRY_SCHEMA_VERSION;

    if (!SUPPORTED_REGISTRY_SCHEMA_VERSIONS.includes(normalized)) {
        throw new RegistryValidationError(`Неподдерживаемая версия схемы реестра: ${value}`);
    }

    return normalized;
}

function normalizePriority(value, fallback = 0) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    const normalized = Number(value);

    return Number.isFinite(normalized) ? Math.trunc(normalized) : fallback;
}

function normalizeSide(side) {
    const normalized = String(side || 'unknown').trim().toLowerCase();

    return ALLOWED_SIDES.has(normalized) ? normalized : 'unknown';
}

function computeRegistrySummary(rules = []) {
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
} = {}) {
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

function createEmptyRegistry(filePath = null, extra = {}) {
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

function normalizeRegistryRule(rule, index, {
    defaultSource = 'registry',
    defaultPriority = 0,
    fallbackRuleIdPrefix = 'rule'
} = {}) {
    const modIds = normalizeStringList(rule.modIds);
    const aliases = normalizeStringList(rule.aliases);
    const fileNames = normalizeStringList(rule.fileNames);
    const loaders = normalizeStringList(rule.loaders);

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

function normalizeRegistryDocument(parsed, {
    filePath = null,
    exists = true,
    defaultSource = 'registry',
    defaultPriority = 0,
    sourceType = 'registry',
    sourceLabel = defaultSource,
    registryVersion = null,
    generatedAt = null
} = {}) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new RegistryValidationError('Некорректный формат registry JSON: ожидается объект');
    }

    const rules = Array.isArray(parsed.rules)
        ? parsed.rules.map((rule, index) => normalizeRegistryRule(rule, index, {
            defaultSource,
            defaultPriority
        }))
        : [];

    return createRegistrySnapshot({
        schemaVersion: parsed.schemaVersion,
        registryVersion: parsed.registryVersion || registryVersion || 'unversioned',
        generatedAt: parsed.generatedAt || generatedAt,
        filePath,
        exists,
        sourceType,
        sourceLabel,
        rules,
        metadata: {
            source: parsed.source || null,
            summary: parsed.summary || null
        }
    });
}

module.exports = {
    computeRegistrySummary,
    createEmptyRegistry,
    createRegistrySnapshot,
    normalizePriority,
    normalizeRegistryDocument,
    normalizeRegistryRule,
    normalizeSchemaVersion,
    normalizeStringList
};
