const fs = require('node:fs');
const path = require('node:path');

import type { ModDescriptor } from '../types/descriptor';
import type { ProbeKnowledgeEntry, ProbeKnowledgeFile, ProbeKnowledgeMatch } from '../types/probe';

const EMPTY_PROBE_KNOWLEDGE: ProbeKnowledgeFile = Object.freeze({
    version: 1,
    updatedAt: '',
    entries: []
});

function normalizeString(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized ? normalized : null;
}

function normalizeStringList(values: unknown): string[] {
    return [...new Set((Array.isArray(values) ? values : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean))]
        .sort((left, right) => left.localeCompare(right));
}

function normalizeKnowledgeEntry(value: unknown): ProbeKnowledgeEntry | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    const candidate = value as Record<string, unknown>;
    const fingerprintValue = candidate.fingerprint;

    if (!fingerprintValue || typeof fingerprintValue !== 'object' || Array.isArray(fingerprintValue)) {
        return null;
    }

    const fingerprint = fingerprintValue as Record<string, unknown>;

    return {
        fingerprint: {
            fileSha256: normalizeString(fingerprint.fileSha256),
            fileName: normalizeString(fingerprint.fileName) || '',
            loader: normalizeString(fingerprint.loader) || 'unknown',
            version: normalizeString(fingerprint.version),
            modIds: normalizeStringList(fingerprint.modIds)
        },
        outcome: normalizeString(candidate.outcome) as ProbeKnowledgeEntry['outcome'] || 'inconclusive',
        semanticDecision: normalizeString(candidate.semanticDecision) as ProbeKnowledgeEntry['semanticDecision'] || 'unknown',
        roleType: normalizeString(candidate.roleType) as ProbeKnowledgeEntry['roleType'] || 'unknown',
        confidence: normalizeString(candidate.confidence) as ProbeKnowledgeEntry['confidence'] || 'none',
        reason: normalizeString(candidate.reason) || 'Probe knowledge entry',
        evidence: normalizeStringList(candidate.evidence),
        observedAt: normalizeString(candidate.observedAt) || '',
        source: 'server-probe',
        exactBoot: Boolean(candidate.exactBoot)
    };
}

function normalizeProbeKnowledgeFile(value: unknown): ProbeKnowledgeFile {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return EMPTY_PROBE_KNOWLEDGE;
    }

    const candidate = value as Record<string, unknown>;

    return {
        version: 1,
        updatedAt: normalizeString(candidate.updatedAt) || '',
        entries: Array.isArray(candidate.entries)
            ? candidate.entries
                .map((entry) => normalizeKnowledgeEntry(entry))
                .filter((entry): entry is ProbeKnowledgeEntry => Boolean(entry))
            : []
    };
}

function resolveProbeKnowledgePath(scriptDir: string, configuredPath?: string | null): string {
    if (configuredPath && String(configuredPath).trim()) {
        return path.resolve(String(configuredPath).trim());
    }

    return path.resolve(scriptDir, 'data', 'probe-knowledge.json');
}

function loadProbeKnowledge(knowledgePath: string | null): ProbeKnowledgeFile {
    if (!knowledgePath) {
        return EMPTY_PROBE_KNOWLEDGE;
    }

    try {
        if (!fs.existsSync(knowledgePath)) {
            return EMPTY_PROBE_KNOWLEDGE;
        }

        return normalizeProbeKnowledgeFile(JSON.parse(fs.readFileSync(knowledgePath, 'utf8')));
    } catch {
        return EMPTY_PROBE_KNOWLEDGE;
    }
}

function saveProbeKnowledge(knowledgePath: string, knowledge: ProbeKnowledgeFile): ProbeKnowledgeFile {
    fs.mkdirSync(path.dirname(knowledgePath), { recursive: true });
    fs.writeFileSync(knowledgePath, `${JSON.stringify(knowledge, null, 2)}\n`, 'utf8');
    return knowledge;
}

function sameModIds(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
        return false;
    }

    return left.every((value, index) => value === right[index]);
}

function findProbeKnowledgeMatch({
    descriptor,
    knowledge
}: {
    descriptor: ModDescriptor;
    knowledge: ProbeKnowledgeFile | null | undefined;
}): ProbeKnowledgeMatch | null {
    if (!knowledge || !Array.isArray(knowledge.entries) || knowledge.entries.length === 0) {
        return null;
    }

    const exactMatch = descriptor.fileSha256
        ? knowledge.entries.find((entry) => entry.fingerprint.fileSha256 === descriptor.fileSha256)
        : null;

    if (exactMatch) {
        return {
            kind: 'exact',
            entry: exactMatch
        };
    }

    const normalizedModIds = [...descriptor.modIds].sort((left, right) => left.localeCompare(right));
    const softMatches = knowledge.entries.filter((entry) => (
        entry.fingerprint.loader === descriptor.loader
        && entry.fingerprint.version === descriptor.version
        && sameModIds(entry.fingerprint.modIds, normalizedModIds)
    ));

    if (softMatches.length !== 1) {
        return null;
    }

    const [softMatch] = softMatches;

    if (!softMatch) {
        return null;
    }

    return {
        kind: 'soft',
        entry: softMatch
    };
}

function upsertProbeKnowledgeEntry({
    knowledgePath,
    entry
}: {
    knowledgePath: string;
    entry: ProbeKnowledgeEntry;
}): ProbeKnowledgeFile {
    const knowledge = loadProbeKnowledge(knowledgePath);
    const nextEntries = knowledge.entries.filter((existingEntry) => existingEntry.fingerprint.fileSha256 !== entry.fingerprint.fileSha256);
    const nextKnowledge: ProbeKnowledgeFile = {
        version: 1,
        updatedAt: new Date().toISOString(),
        entries: [...nextEntries, entry].sort((left, right) => left.fingerprint.fileName.localeCompare(right.fingerprint.fileName))
    };

    return saveProbeKnowledge(knowledgePath, nextKnowledge);
}

module.exports = {
    EMPTY_PROBE_KNOWLEDGE,
    findProbeKnowledgeMatch,
    loadProbeKnowledge,
    normalizeProbeKnowledgeFile,
    resolveProbeKnowledgePath,
    saveProbeKnowledge,
    upsertProbeKnowledgeEntry
};
