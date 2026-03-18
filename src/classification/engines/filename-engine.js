const { isClientMod } = require('../../core/legacy-matcher');
const { CONFIDENCE_LEVELS, ENGINE_DECISIONS } = require('../constants');

const filenameEngine = {
    name: 'filename-engine',
    classify({ descriptor, classificationContext }) {
        const matchedRule = isClientMod(descriptor.fileName, classificationContext.blockList);

        if (!matchedRule) {
            return {
                decision: ENGINE_DECISIONS.unknown,
                confidence: CONFIDENCE_LEVELS.none,
                reason: 'Legacy filename matcher did not find a client-only pattern'
            };
        }

        return {
            decision: ENGINE_DECISIONS.remove,
            confidence: CONFIDENCE_LEVELS.low,
            reason: `Legacy filename matcher matched "${matchedRule}"`,
            matchedRule,
            matchedRuleSource: 'block.txt',
            evidence: [
                {
                    type: 'legacy-rule',
                    value: matchedRule,
                    source: 'block.txt'
                }
            ]
        };
    }
};

module.exports = {
    filenameEngine
};
