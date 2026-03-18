const {
    CLIENT_NAMESPACE_PATTERNS,
    CLIENT_RESOURCE_PATTERNS,
    SERVER_SAFE_PATTERNS
} = require('../signatures/client-only');

import type { ArchiveContentAnalysis } from '../../types/deep-check';

function pushUnique(list: string[], item: string): void {
    if (!list.includes(item)) {
        list.push(item);
    }
}

function analyzeArchiveContent(archive: { entries?: string[] }): ArchiveContentAnalysis {
    const summary: ArchiveContentAnalysis = {
        totalEntries: Array.isArray(archive.entries) ? archive.entries.length : 0,
        classEntries: 0,
        strongClientNamespaceHits: [],
        weakClientPathHits: [],
        clientResourceHits: [],
        serverSafeHits: [],
        warnings: []
    };

    for (const entryName of archive.entries || []) {
        const normalized = String(entryName || '').trim().toLowerCase();

        if (!normalized) {
            continue;
        }

        if (normalized.endsWith('.class')) {
            summary.classEntries += 1;
        }

        for (const pattern of CLIENT_NAMESPACE_PATTERNS) {
            if (!normalized.includes(pattern)) {
                continue;
            }

            if (pattern === 'net/minecraft/client/') {
                pushUnique(summary.strongClientNamespaceHits, entryName);
            } else {
                pushUnique(summary.weakClientPathHits, entryName);
            }
        }

        for (const pattern of CLIENT_RESOURCE_PATTERNS) {
            if (normalized.includes(pattern)) {
                pushUnique(summary.clientResourceHits, entryName);
            }
        }

        for (const pattern of SERVER_SAFE_PATTERNS) {
            if (normalized.includes(pattern)) {
                pushUnique(summary.serverSafeHits, entryName);
            }
        }
    }

    return summary;
}

module.exports = {
    analyzeArchiveContent
};
