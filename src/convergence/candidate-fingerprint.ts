const crypto = require('node:crypto');

import type { CandidateFingerprint, CandidateFingerprintFile } from './types';
import type { RunContext } from '../types/run';
import type { LoaderKind } from '../types/metadata';

function sortStringList(values: string[]): string[] {
    return [...values].sort((left, right) => left.localeCompare(right));
}

function normalizeFingerprintFile(decision: Record<string, any>): CandidateFingerprintFile | null {
    const descriptor = decision?.descriptor;
    const fileName = decision?.fileName || descriptor?.fileName || null;

    if (!fileName) {
        return null;
    }

    return {
        fileName,
        fileSha256: descriptor?.fileSha256 || null,
        loader: (descriptor?.loader || 'unknown') as LoaderKind | 'unknown',
        modIds: sortStringList(Array.isArray(descriptor?.modIds) ? descriptor.modIds.map((item: unknown) => String(item)) : []),
        version: descriptor?.version || null
    };
}

function createFingerprintDigest(payload: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function createCandidateFingerprint({
    runContext,
    decisions
}: {
    runContext: RunContext;
    decisions: Array<Record<string, any>>;
}): CandidateFingerprint {
    const files = decisions
        .map((decision) => normalizeFingerprintFile(decision))
        .filter((entry): entry is CandidateFingerprintFile => Boolean(entry))
        .sort((left, right) => left.fileName.localeCompare(right.fileName));
    const detectedLoaders = sortStringList(
        files
            .map((entry) => entry.loader)
            .filter((loader): loader is LoaderKind => loader !== 'unknown')
    ) as LoaderKind[];
    const stablePayload = {
        inputKind: runContext.inputKind,
        instanceSource: runContext.instanceSource,
        files
    };

    return {
        algorithm: 'sha256',
        digest: createFingerprintDigest(stablePayload),
        totalFiles: files.length,
        detectedLoaders,
        inputKind: runContext.inputKind,
        instanceSource: runContext.instanceSource,
        files
    };
}

function areCandidateFingerprintsEqual(left: CandidateFingerprint, right: CandidateFingerprint): boolean {
    return left.algorithm === right.algorithm && left.digest === right.digest;
}

module.exports = {
    areCandidateFingerprintsEqual,
    createCandidateFingerprint
};
