const {
    CLIENT_ENTRYPOINT_KEYWORDS,
    SERVER_ENTRYPOINT_KEYWORDS
} = require('../signatures/client-only');

import type { EntrypointAnalysis } from '../../types/deep-check';

function includesAny(value: unknown, keywords: readonly string[]): boolean {
    const normalized = String(value || '').trim().toLowerCase();

    if (!normalized) {
        return false;
    }

    return keywords.some((keyword) => normalized.includes(keyword));
}

function classifyEntrypoint(entrypoint: Record<string, unknown>): 'client' | 'server' | 'common' {
    const key = String(entrypoint && entrypoint.key ? entrypoint.key : '').trim().toLowerCase();
    const value = String(entrypoint && entrypoint.value ? entrypoint.value : '').trim().toLowerCase();

    if (includesAny(key, CLIENT_ENTRYPOINT_KEYWORDS) || includesAny(value, CLIENT_ENTRYPOINT_KEYWORDS)) {
        return 'client';
    }

    if (includesAny(key, SERVER_ENTRYPOINT_KEYWORDS) || includesAny(value, SERVER_ENTRYPOINT_KEYWORDS)) {
        return 'server';
    }

    return 'common';
}

function analyzeEntrypoints(descriptor: { entrypoints?: Array<Record<string, unknown>> } | null | undefined): EntrypointAnalysis {
    const entrypoints: Array<Record<string, unknown>> = descriptor && Array.isArray(descriptor.entrypoints) ? descriptor.entrypoints : [];
    const summary: EntrypointAnalysis = {
        total: entrypoints.length,
        clientEntrypoints: [],
        serverEntrypoints: [],
        commonEntrypoints: [],
        hasOnlyClientEntrypoints: false,
        hasDedicatedServerEntrypoints: false,
        hasSharedEntrypoints: false
    };

    for (const entrypoint of entrypoints) {
        const bucket = classifyEntrypoint(entrypoint);

        if (bucket === 'client') {
            summary.clientEntrypoints.push(entrypoint);
            continue;
        }

        if (bucket === 'server') {
            summary.serverEntrypoints.push(entrypoint);
            continue;
        }

        summary.commonEntrypoints.push(entrypoint);
    }

    summary.hasOnlyClientEntrypoints = summary.clientEntrypoints.length > 0
        && summary.serverEntrypoints.length === 0
        && summary.commonEntrypoints.length === 0;
    summary.hasDedicatedServerEntrypoints = summary.serverEntrypoints.length > 0;
    summary.hasSharedEntrypoints = summary.commonEntrypoints.length > 0;

    return summary;
}

module.exports = {
    analyzeEntrypoints
};
