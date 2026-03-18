const fs = require('fs');
const path = require('path');

const { FileReadError } = require('../core/errors');
const {
    DEFAULT_LOCAL_OVERRIDE_PRIORITY,
    FORCE_LOCAL_OVERRIDE_PRIORITY,
    REGISTRY_SCHEMA_VERSION
} = require('./constants');
const { createEmptyRegistry, normalizeRegistryDocument, normalizeRegistryRule, normalizeStringList } = require('./rules');

function createEmptyLocalOverrides(filePath = null) {
    return createEmptyRegistry(filePath, {
        sourceType: 'local-overrides',
        sourceLabel: 'local-overrides',
        registryVersion: 'local-overrides'
    });
}

function normalizeOverrideSelectors(rule) {
    const modIds = normalizeStringList(rule.modIds || (rule.modId ? [rule.modId] : []));
    const aliases = normalizeStringList(rule.aliases || (rule.alias ? [rule.alias] : []));
    const fileNames = normalizeStringList(rule.fileNames || (rule.fileName ? [rule.fileName] : []));
    const loaders = normalizeStringList(rule.loaders || (rule.loader ? [rule.loader] : []));

    return {
        modIds,
        aliases,
        fileNames,
        loaders
    };
}

function normalizeForcedOverrides(list, side, label) {
    if (!Array.isArray(list)) {
        return [];
    }

    return list.map((rule, index) => normalizeRegistryRule({
        ...normalizeOverrideSelectors(rule),
        ruleId: rule.ruleId || `${label}-${index + 1}`,
        side,
        confidence: rule.confidence || 'high',
        reason: rule.reason || (side === 'client'
            ? 'Локальный override принудительно исключает мод'
            : 'Локальный override принудительно сохраняет мод'),
        source: rule.source || 'local-overrides',
        priority: rule.priority ?? FORCE_LOCAL_OVERRIDE_PRIORITY
    }, index, {
        defaultSource: 'local-overrides',
        defaultPriority: FORCE_LOCAL_OVERRIDE_PRIORITY,
        fallbackRuleIdPrefix: label
    }));
}

function normalizeLocalOverridesDocument(parsed, filePath = null) {
    const baseRules = normalizeRegistryDocument(parsed, {
        filePath,
        exists: true,
        defaultSource: 'local-overrides',
        defaultPriority: DEFAULT_LOCAL_OVERRIDE_PRIORITY,
        sourceType: 'local-overrides',
        sourceLabel: 'local-overrides',
        registryVersion: 'local-overrides'
    });
    const forceKeepRules = normalizeForcedOverrides(parsed.forceKeep, 'both', 'force-keep');
    const forceRemoveRules = normalizeForcedOverrides(parsed.forceRemove, 'client', 'force-remove');

    return {
        ...baseRules,
        schemaVersion: Number(parsed.schemaVersion) || REGISTRY_SCHEMA_VERSION,
        rules: [...baseRules.rules, ...forceKeepRules, ...forceRemoveRules]
    };
}

function loadLocalOverrides(filePath, { required = false, logger = null } = {}) {
    const resolvedPath = filePath ? path.resolve(filePath) : null;

    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
        if (required) {
            throw new FileReadError(`Не удалось прочитать файл локальных overrides: ${filePath}`);
        }

        return createEmptyLocalOverrides(resolvedPath);
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
        return normalizeLocalOverridesDocument(parsed, resolvedPath);
    } catch (error) {
        if (logger) {
            logger.warn(`Файл локальных overrides будет проигнорирован: ${resolvedPath}`);
        }

        throw new FileReadError(`Не удалось разобрать локальные overrides: ${resolvedPath}`, { cause: error });
    }
}

module.exports = {
    createEmptyLocalOverrides,
    loadLocalOverrides,
    normalizeLocalOverridesDocument
};
