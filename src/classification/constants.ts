const ENGINE_DECISIONS = Object.freeze({
    keep: 'keep',
    remove: 'remove',
    unknown: 'unknown',
    error: 'error'
});

const CONFIDENCE_LEVELS = Object.freeze({
    high: 'high',
    medium: 'medium',
    low: 'low',
    none: 'none'
});

const DEFAULT_ENABLED_ENGINES = Object.freeze([
    'probe-knowledge-engine',
    'metadata-engine',
    'forge-bytecode-engine',
    'client-signature-engine',
    'forge-semantic-engine',
    'registry-engine',
    'filename-engine'
]);

module.exports = {
    CONFIDENCE_LEVELS,
    DEFAULT_ENABLED_ENGINES,
    ENGINE_DECISIONS
};
