const { findProbeKnowledgeMatch } = require('../../probe/knowledge-store');

import type { ClassificationEngine } from '../../types/classification';
import type { ProbeKnowledgeEntry } from '../../types/probe';

function isDecisiveEntry(entry: ProbeKnowledgeEntry): boolean {
    return (entry.semanticDecision === 'keep' || entry.semanticDecision === 'remove')
        && (entry.confidence === 'high' || entry.confidence === 'medium');
}

function buildReason(entry: ProbeKnowledgeEntry, matchKind: 'exact' | 'soft'): string {
    if (matchKind === 'exact') {
        return `Probe knowledge matched exact jar fingerprint (${entry.outcome})`;
    }

    return `Probe knowledge matched the same loader/mod ids/version (${entry.outcome})`;
}

const probeKnowledgeEngine: ClassificationEngine = {
    name: 'probe-knowledge-engine',
    classify({ descriptor, classificationContext }) {
        const knowledge = classificationContext.probeKnowledge;

        if (!knowledge) {
            return null;
        }

        const match = findProbeKnowledgeMatch({
            descriptor,
            knowledge: {
                version: 1,
                updatedAt: '',
                entries: Array.isArray(knowledge.entries) ? knowledge.entries : []
            }
        });

        if (!match) {
            return null;
        }

        const reason = buildReason(match.entry, match.kind);
        const evidence = [
            { type: 'probe-outcome', value: match.entry.outcome, source: 'server-probe' },
            { type: 'probe-match', value: match.kind, source: 'server-probe' },
            { type: 'probe-observed-at', value: match.entry.observedAt || 'unknown', source: 'server-probe' },
            ...match.entry.evidence.slice(0, 3).map((value: string) => ({
                type: 'probe-evidence',
                value,
                source: 'server-probe'
            }))
        ];

        if (match.kind === 'exact' && isDecisiveEntry(match.entry)) {
            return {
                decision: match.entry.semanticDecision === 'remove' ? 'remove' : 'keep',
                confidence: 'high',
                reason,
                evidence,
                roleType: match.entry.roleType,
                roleConfidence: match.entry.confidence === 'none' ? 'high' : match.entry.confidence,
                roleReason: match.entry.reason
            };
        }

        return {
            decision: 'unknown',
            confidence: 'none',
            reason,
            evidence,
            roleType: match.entry.roleType,
            roleConfidence: match.kind === 'exact' ? match.entry.confidence : 'medium',
            roleReason: match.entry.reason
        };
    }
};

module.exports = {
    probeKnowledgeEngine
};
