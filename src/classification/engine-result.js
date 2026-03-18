const { CONFIDENCE_LEVELS, ENGINE_DECISIONS } = require('./constants');

function normalizeEngineName(engine) {
    const value = String(engine || '').trim().toLowerCase();

    if (!value) {
        throw new Error('Engine name is required');
    }

    if (!/^[a-z0-9-]+-engine$/.test(value)) {
        throw new Error(`Invalid engine name: ${engine}`);
    }

    return value;
}

function normalizeDecision(decision) {
    return Object.values(ENGINE_DECISIONS).includes(decision) ? decision : ENGINE_DECISIONS.unknown;
}

function normalizeConfidence(confidence) {
    return Object.values(CONFIDENCE_LEVELS).includes(confidence) ? confidence : CONFIDENCE_LEVELS.none;
}

function normalizeTextList(values) {
    if (!Array.isArray(values)) {
        return [];
    }

    return values
        .map((value) => String(value || '').trim())
        .filter(Boolean);
}

function normalizeEvidence(evidence) {
    if (!Array.isArray(evidence)) {
        return [];
    }

    return evidence
        .map((item) => {
            if (!item) {
                return null;
            }

            if (typeof item === 'string') {
                return {
                    type: 'text',
                    value: item,
                    source: null
                };
            }

            if (typeof item === 'object') {
                return {
                    type: item.type ? String(item.type) : 'text',
                    value: item.value !== undefined && item.value !== null ? String(item.value) : '',
                    source: item.source ? String(item.source) : null
                };
            }

            return null;
        })
        .filter((item) => item && item.value);
}

function normalizeError(error) {
    if (!error) {
        return null;
    }

    if (typeof error === 'string') {
        return {
            code: 'ENGINE_ERROR',
            message: error
        };
    }

    return {
        code: error.code || 'ENGINE_ERROR',
        message: error.message || 'Engine execution failed'
    };
}

function createEngineResult({
    engine,
    decision = ENGINE_DECISIONS.unknown,
    confidence = CONFIDENCE_LEVELS.none,
    reason = 'No decisive signal',
    evidence = [],
    warnings = [],
    error = null,
    matchedRule = null,
    matchedRuleSource = null
}) {
    return {
        engine: normalizeEngineName(engine),
        decision: normalizeDecision(decision),
        confidence: normalizeConfidence(confidence),
        reason: String(reason || 'No decisive signal'),
        evidence: normalizeEvidence(evidence),
        warnings: normalizeTextList(warnings),
        error: normalizeError(error),
        matchedRule: matchedRule ? String(matchedRule) : null,
        matchedRuleSource: matchedRuleSource ? String(matchedRuleSource) : null
    };
}

function createEngineErrorResult({ engine, error, reason = null }) {
    const normalizedError = normalizeError(error);

    return createEngineResult({
        engine,
        decision: ENGINE_DECISIONS.error,
        confidence: CONFIDENCE_LEVELS.none,
        reason: reason || normalizedError.message,
        warnings: [],
        error: normalizedError
    });
}

function confidenceRank(confidence) {
    switch (normalizeConfidence(confidence)) {
        case CONFIDENCE_LEVELS.high:
            return 3;
        case CONFIDENCE_LEVELS.medium:
            return 2;
        case CONFIDENCE_LEVELS.low:
            return 1;
        default:
            return 0;
    }
}

module.exports = {
    confidenceRank,
    createEngineErrorResult,
    createEngineResult,
    normalizeConfidence,
    normalizeDecision,
    normalizeEngineName
};
