const fs = require('node:fs');
const path = require('node:path');

const { FileReadError } = require('../core/errors');
const {
    DEFAULT_LOCAL_OVERRIDE_PRIORITY,
    FORCE_LOCAL_OVERRIDE_PRIORITY,
    REGISTRY_SCHEMA_VERSION
} = require('./constants');
const { createEmptyRegistry, normalizeRegistryDocument, normalizeRegistryRule, normalizeStringList } = require('./rules');

import type { EffectiveRegistry } from '../types/registry';

function createEmptyLocalOverrides(filePath: string | null = null): EffectiveRegistry {
    return createEmptyRegistry(filePath, {
        sourceType: 'local-overrides',
        sourceLabel: 'local-overrides',
        registryVersion: 'local-overrides'
    });
}

function normalizeOverrideSelectors(rule: Record<string, unknown>) {
    const modIds = normalizeStringList((rule.modIds as unknown[]) || (rule.modId ? [rule.modId] : []));
    const aliases = normalizeStringList((rule.aliases as unknown[]) || (rule.alias ? [rule.alias] : []));
    const fileNames = normalizeStringList((rule.fileNames as unknown[]) || (rule.fileName ? [rule.fileName] : []));
    const loaders = normalizeStringList((rule.loaders as unknown[]) || (rule.loader ? [rule.loader] : []));

    return {
        modIds,
        aliases,
        fileNames,
        loaders
    };
}

function normalizeForcedOverrides(list: unknown, side: 'both' | 'client', label: string) {
    if (!Array.isArray(list)) {
        return [];
    }

    return list.map((rule, index) => {
        const normalizedRule = rule as Record<string, unknown>;

        return normalizeRegistryRule({
            ...normalizeOverrideSelectors(normalizedRule),
            ruleId: normalizedRule.ruleId || `${label}-${index + 1}`,
            side,
            confidence: normalizedRule.confidence || 'high',
            reason: normalizedRule.reason || (side === 'client'
                ? 'Локальный override принудительно исключает мод'
                : 'Локальный override принудительно сохраняет мод'),
            source: normalizedRule.source || 'local-overrides',
            priority: normalizedRule.priority ?? FORCE_LOCAL_OVERRIDE_PRIORITY
        }, index, {
            defaultSource: 'local-overrides',
            defaultPriority: FORCE_LOCAL_OVERRIDE_PRIORITY,
            fallbackRuleIdPrefix: label
        });
    });
}

function normalizeLocalOverridesDocument(parsed: Record<string, unknown>, filePath: string | null = null): EffectiveRegistry {
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

function loadLocalOverrides(
    filePath: string | null,
    {
        required = false,
        logger = null
    }: {
        required?: boolean;
        logger?: {
            warn?: (message: string) => void;
        } | null;
    } = {}
): EffectiveRegistry {
    const resolvedPath = filePath ? path.resolve(filePath) : null;

    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
        if (required) {
            throw new FileReadError(`Не удалось прочитать файл локальных overrides: ${filePath}`);
        }

        return createEmptyLocalOverrides(resolvedPath);
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf8')) as Record<string, unknown>;
        return normalizeLocalOverridesDocument(parsed, resolvedPath);
    } catch (error) {
        if (logger) {
            logger.warn?.(`Файл локальных overrides будет проигнорирован: ${resolvedPath}`);
        }

        throw new FileReadError(`Не удалось разобрать локальные overrides: ${resolvedPath}`, { cause: error });
    }
}

module.exports = {
    createEmptyLocalOverrides,
    loadLocalOverrides,
    normalizeLocalOverridesDocument
};
