const path = require('path');

const { CONFIDENCE_LEVELS, ENGINE_DECISIONS } = require('../constants');
const { isClientMod } = require('../../core/legacy-matcher');

function collectDescriptorIds(descriptor) {
    return new Set(
        [...descriptor.modIds, ...descriptor.provides]
            .map((value) => String(value || '').trim().toLowerCase())
            .filter(Boolean)
    );
}

function scoreRuleMatch(rule, descriptor, descriptorIds) {
    if (rule.loaders.length > 0 && !rule.loaders.includes(descriptor.loader)) {
        return 0;
    }

    let score = 0;

    if (rule.modIds.some((modId) => descriptorIds.has(modId))) {
        score += 100;
    }

    if (rule.aliases.some((alias) => descriptorIds.has(alias))) {
        score += 50;
    }

    const fileStem = path.basename(descriptor.fileName, '.jar').toLowerCase();

    for (const fileNameRule of rule.fileNames) {
        if (fileStem === fileNameRule) {
            score += 25;
            continue;
        }

        if (isClientMod(descriptor.fileName, [fileNameRule])) {
            score += 10;
        }
    }

    return score;
}

function pickBestRule(descriptor, registry) {
    const descriptorIds = collectDescriptorIds(descriptor);
    const scored = registry.rules
        .map((rule) => ({
            rule,
            score: scoreRuleMatch(rule, descriptor, descriptorIds)
        }))
        .filter((item) => item.score > 0)
        .sort((left, right) => {
            const priorityDiff = (right.rule.priority || 0) - (left.rule.priority || 0);

            if (priorityDiff !== 0) {
                return priorityDiff;
            }

            if (right.score !== left.score) {
                return right.score - left.score;
            }

            return 0;
        });

    return {
        bestRule: scored[0] ? scored[0].rule : null,
        matchedCount: scored.length
    };
}

function sideToDecision(side) {
    if (side === 'client') {
        return ENGINE_DECISIONS.remove;
    }

    if (side === 'server' || side === 'both') {
        return ENGINE_DECISIONS.keep;
    }

    return ENGINE_DECISIONS.unknown;
}

const registryEngine = {
    name: 'registry-engine',
    classify({ descriptor, classificationContext }) {
        const registry = classificationContext.localRegistry;

        if (!registry || !Array.isArray(registry.rules) || registry.rules.length === 0) {
            return {
                decision: ENGINE_DECISIONS.unknown,
                confidence: CONFIDENCE_LEVELS.none,
                reason: 'Local registry does not contain matching rules'
            };
        }

        const { bestRule, matchedCount } = pickBestRule(descriptor, registry);

        if (!bestRule) {
            return {
                decision: ENGINE_DECISIONS.unknown,
                confidence: CONFIDENCE_LEVELS.none,
                reason: 'No local registry rule matched this mod'
            };
        }

        const decision = sideToDecision(bestRule.side);
        const warnings = matchedCount > 1 ? [`Multiple local registry rules matched; selected ${bestRule.ruleId}`] : [];

        return {
            decision,
            confidence: bestRule.confidence || CONFIDENCE_LEVELS.medium,
            reason: bestRule.reason,
            matchedRule: bestRule.ruleId,
            matchedRuleSource: bestRule.source,
            warnings,
            evidence: [
                {
                    type: 'registry-rule',
                    value: bestRule.ruleId,
                    source: bestRule.source
                },
                {
                    type: 'registry-side',
                    value: bestRule.side,
                    source: bestRule.source
                }
            ]
        };
    }
};

module.exports = {
    registryEngine
};
