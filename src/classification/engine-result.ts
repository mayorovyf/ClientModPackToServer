const { CONFIDENCE_LEVELS, ENGINE_DECISIONS } = require('./constants');

import type {
    ConfidenceLevel,
    EngineDecision,
    EngineError,
    EngineEvidence,
    EngineResult
} from '../types/classification';

function normalizeEngineName(engine: unknown): string {
    const value = String(engine || '').trim().toLowerCase();

    if (!value) {
        throw new Error('Engine name is required');
    }

    if (!/^[a-z0-9-]+-engine$/.test(value)) {
        throw new Error(`Invalid engine name: ${engine}`);
    }

    return value;
}

function normalizeDecision(decision: unknown): EngineDecision {
    return Object.values(ENGINE_DECISIONS).includes(decision as string)
        ? decision as EngineDecision
        : ENGINE_DECISIONS.unknown;
}

function normalizeConfidence(confidence: unknown): ConfidenceLevel {
    return Object.values(CONFIDENCE_LEVELS).includes(confidence as string)
        ? confidence as ConfidenceLevel
        : CONFIDENCE_LEVELS.none;
}

function normalizeTextList(values: unknown): string[] {
    if (!Array.isArray(values)) {
        return [];
    }

    return values
        .map((value) => String(value || '').trim())
        .filter(Boolean);
}

function normalizeEvidence(evidence: unknown): EngineEvidence[] {
    if (!Array.isArray(evidence)) {
        return [];
    }

    const normalized: EngineEvidence[] = [];

    for (const item of evidence) {
        if (!item) {
            continue;
        }

        if (typeof item === 'string') {
            normalized.push({
                type: 'text',
                value: item,
                source: null
            });
            continue;
        }

        if (typeof item === 'object') {
            const evidenceItem = item as Record<string, unknown>;
            const value = evidenceItem.value !== undefined && evidenceItem.value !== null ? String(evidenceItem.value) : '';

            if (!value) {
                continue;
            }

            normalized.push({
                type: evidenceItem.type ? String(evidenceItem.type) : 'text',
                value,
                source: evidenceItem.source ? String(evidenceItem.source) : null
            });
        }
    }

    return normalized;
}

function normalizeError(error: unknown): EngineError | null {
    if (!error) {
        return null;
    }

    if (typeof error === 'string') {
        return {
            code: 'ENGINE_ERROR',
            message: error
        };
    }

    if (typeof error === 'object') {
        const errorObject = error as Record<string, unknown>;

        return {
            code: errorObject.code ? String(errorObject.code) : 'ENGINE_ERROR',
            message: errorObject.message ? String(errorObject.message) : 'Engine execution failed'
        };
    }

    return {
        code: 'ENGINE_ERROR',
        message: 'Engine execution failed'
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
}: {
    engine: unknown;
    decision?: unknown;
    confidence?: unknown;
    reason?: unknown;
    evidence?: unknown;
    warnings?: unknown;
    error?: unknown;
    matchedRule?: unknown;
    matchedRuleSource?: unknown;
}): EngineResult {
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

function createEngineErrorResult({
    engine,
    error,
    reason = null
}: {
    engine: unknown;
    error: unknown;
    reason?: string | null;
}): EngineResult {
    const normalizedError = normalizeError(error);

    return createEngineResult({
        engine,
        decision: ENGINE_DECISIONS.error,
        confidence: CONFIDENCE_LEVELS.none,
        reason: reason || (normalizedError ? normalizedError.message : 'Engine execution failed'),
        warnings: [],
        error: normalizedError
    });
}

function confidenceRank(confidence: unknown): number {
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
