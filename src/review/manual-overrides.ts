import fs from 'node:fs';
import path from 'node:path';

import type { ModDescriptor } from '../types/descriptor';

export type ManualReviewAction = 'keep' | 'exclude';

export interface ManualReviewSubject {
    key: string;
    fileName: string;
    modIds: string[];
    displayName: string | null;
    version: string | null;
    loader: string | null;
}

export interface ManualReviewOverrideEntry extends ManualReviewSubject {
    action: ManualReviewAction;
    reason: string;
    updatedAt: string;
    confirmedAt?: string | null;
}

export interface ManualReviewOverridesFile {
    version: 1;
    updatedAt: string;
    entries: ManualReviewOverrideEntry[];
}

export interface ManualReviewOverrideMatch {
    entry: ManualReviewOverrideEntry;
    matchType: 'key' | 'fileName';
}

export interface ManualReviewApplicationSummary {
    overridesPath: string | null;
    totalEntries: number;
    appliedOverrides: number;
    kept: number;
    excluded: number;
}

export interface ManualReviewApplicationResult<T> {
    decisions: T[];
    summary: ManualReviewApplicationSummary;
}

const EMPTY_MANUAL_REVIEW_OVERRIDES: ManualReviewOverridesFile = Object.freeze({
    version: 1,
    updatedAt: '',
    entries: []
});

function normalizeFileName(fileName: string): string {
    return String(fileName || '').trim().toLowerCase();
}

function normalizeModIds(modIds: string[] | null | undefined): string[] {
    return [...new Set((modIds || []).map((item) => String(item || '').trim().toLowerCase()).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right));
}

export function createManualReviewKey({
    fileName,
    modIds
}: {
    fileName: string;
    modIds: string[];
}): string {
    const normalizedModIds = normalizeModIds(modIds);

    if (normalizedModIds.length > 0) {
        return `mods:${normalizedModIds.join('+')}`;
    }

    return `file:${normalizeFileName(fileName)}`;
}

export function createManualReviewSubject({
    fileName,
    descriptor
}: {
    fileName: string;
    descriptor?: Partial<ModDescriptor> | null;
}): ManualReviewSubject {
    const modIds = normalizeModIds(descriptor?.modIds);

    return {
        key: createManualReviewKey({
            fileName,
            modIds
        }),
        fileName: String(fileName || '').trim(),
        modIds,
        displayName: typeof descriptor?.displayName === 'string' ? descriptor.displayName : null,
        version: typeof descriptor?.version === 'string' ? descriptor.version : null,
        loader: typeof descriptor?.loader === 'string' ? descriptor.loader : null
    };
}

export function resolveReviewOverridesPath(scriptDir: string, configuredPath?: string | null): string {
    if (configuredPath && String(configuredPath).trim()) {
        return path.resolve(String(configuredPath).trim());
    }

    return path.resolve(scriptDir, 'data', 'review-overrides.json');
}

export function loadManualReviewOverrides(overridesPath: string | null): ManualReviewOverridesFile {
    if (!overridesPath) {
        return EMPTY_MANUAL_REVIEW_OVERRIDES;
    }

    try {
        if (!fs.existsSync(overridesPath)) {
            return EMPTY_MANUAL_REVIEW_OVERRIDES;
        }

        const parsed = JSON.parse(fs.readFileSync(overridesPath, 'utf8')) as Partial<ManualReviewOverridesFile>;

        return {
            version: 1,
            updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
            entries: Array.isArray(parsed.entries)
                ? parsed.entries
                    .filter((entry): entry is ManualReviewOverrideEntry => Boolean(entry && typeof entry === 'object'))
                    .map((entry) => ({
                        key: String(entry.key || '').trim() || createManualReviewKey({
                            fileName: String(entry.fileName || ''),
                            modIds: normalizeModIds(entry.modIds)
                        }),
                        fileName: String(entry.fileName || '').trim(),
                        modIds: normalizeModIds(entry.modIds),
                        displayName: typeof entry.displayName === 'string' ? entry.displayName : null,
                        version: typeof entry.version === 'string' ? entry.version : null,
                        loader: typeof entry.loader === 'string' ? entry.loader : null,
                        action: entry.action === 'exclude' ? 'exclude' : 'keep',
                        reason: typeof entry.reason === 'string' ? entry.reason : '',
                        updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '',
                        confirmedAt: typeof entry.confirmedAt === 'string' ? entry.confirmedAt : null
                    }))
                : []
        };
    } catch {
        return EMPTY_MANUAL_REVIEW_OVERRIDES;
    }
}

export function findManualReviewOverride(
    overrides: ManualReviewOverridesFile,
    subject: ManualReviewSubject
): ManualReviewOverrideMatch | null {
    const normalizedFileName = normalizeFileName(subject.fileName);
    const byKey = overrides.entries.find((entry) => entry.key === subject.key);

    if (byKey) {
        return {
            entry: byKey,
            matchType: 'key'
        };
    }

    const byFileName = overrides.entries.find((entry) => normalizeFileName(entry.fileName) === normalizedFileName);

    if (byFileName) {
        return {
            entry: byFileName,
            matchType: 'fileName'
        };
    }

    return null;
}

function ensureParentDirectory(filePath: string): void {
    const directoryPath = path.dirname(filePath);

    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }
}

function writeManualReviewOverrides(overridesPath: string, overrides: ManualReviewOverridesFile): void {
    ensureParentDirectory(overridesPath);
    fs.writeFileSync(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`, 'utf8');
}

export function setManualReviewOverride({
    overridesPath,
    subject,
    action,
    reason = ''
}: {
    overridesPath: string;
    subject: ManualReviewSubject;
    action: ManualReviewAction;
    reason?: string;
}): ManualReviewOverridesFile {
    const overrides = loadManualReviewOverrides(overridesPath);
    const previousMatch = findManualReviewOverride(overrides, subject);
    const updatedAt = new Date().toISOString();
    const nextEntry: ManualReviewOverrideEntry = {
        ...subject,
        action,
        reason: String(reason || '').trim(),
        updatedAt,
        confirmedAt: previousMatch?.entry.action === action
            ? previousMatch.entry.confirmedAt || null
            : null
    };
    const filteredEntries = overrides.entries.filter((entry) => (
        entry.key !== subject.key && normalizeFileName(entry.fileName) !== normalizeFileName(subject.fileName)
    ));
    const nextOverrides: ManualReviewOverridesFile = {
        version: 1,
        updatedAt,
        entries: [...filteredEntries, nextEntry].sort((left, right) => left.fileName.localeCompare(right.fileName))
    };

    writeManualReviewOverrides(overridesPath, nextOverrides);
    return nextOverrides;
}

export function confirmManualReviewOverride({
    overridesPath,
    subject
}: {
    overridesPath: string;
    subject: ManualReviewSubject;
}): ManualReviewOverridesFile {
    const overrides = loadManualReviewOverrides(overridesPath);
    const match = findManualReviewOverride(overrides, subject);

    if (!match) {
        return overrides;
    }

    const updatedAt = new Date().toISOString();
    const nextOverrides: ManualReviewOverridesFile = {
        version: 1,
        updatedAt,
        entries: overrides.entries
            .map((entry) => entry.key === match.entry.key
                ? {
                    ...entry,
                    updatedAt,
                    confirmedAt: updatedAt
                }
                : entry)
            .sort((left, right) => left.fileName.localeCompare(right.fileName))
    };

    writeManualReviewOverrides(overridesPath, nextOverrides);
    return nextOverrides;
}

export function removeManualReviewOverride({
    overridesPath,
    subject
}: {
    overridesPath: string;
    subject: ManualReviewSubject;
}): ManualReviewOverridesFile {
    const overrides = loadManualReviewOverrides(overridesPath);
    const filteredEntries = overrides.entries.filter((entry) => (
        entry.key !== subject.key && normalizeFileName(entry.fileName) !== normalizeFileName(subject.fileName)
    ));
    const nextOverrides: ManualReviewOverridesFile = {
        version: 1,
        updatedAt: new Date().toISOString(),
        entries: filteredEntries
    };

    writeManualReviewOverrides(overridesPath, nextOverrides);
    return nextOverrides;
}

export function applyManualReviewOverrides<T extends {
    fileName: string;
    descriptor?: Partial<ModDescriptor> | null;
    decision: 'keep' | 'exclude';
    reason: string;
    decisionOrigin: string | null;
    finalSemanticDecision?: string | null;
    finalConfidence?: string | null;
    finalDecisionOrigin?: string | null;
    finalReasons?: string[];
    requiresReview?: boolean;
    requiresDeepCheck?: boolean;
    deepCheckStatus?: string | null;
    manualReviewKey?: string | null;
    manualOverrideAction?: ManualReviewAction | null;
    manualOverrideReason?: string | null;
    manualOverrideUpdatedAt?: string | null;
}>({
    decisions,
    overridesPath,
    record
}: {
    decisions: T[];
    overridesPath: string | null;
    record?: (level: string, kind: string, message: string) => void;
}): ManualReviewApplicationResult<T> {
    const overrides = loadManualReviewOverrides(overridesPath);
    const summary: ManualReviewApplicationSummary = {
        overridesPath,
        totalEntries: overrides.entries.length,
        appliedOverrides: 0,
        kept: 0,
        excluded: 0
    };

    const nextDecisions = decisions.map((decision) => {
        const subject = createManualReviewSubject({
            fileName: decision.fileName,
            descriptor: decision.descriptor || null
        });
        const match = findManualReviewOverride(overrides, subject);

        if (!match) {
            return {
                ...decision,
                manualReviewKey: subject.key,
                manualOverrideAction: null,
                manualOverrideReason: null,
                manualOverrideUpdatedAt: null
            };
        }

        const action = match.entry.action;
        const nextDecision = action === 'exclude' ? 'exclude' : 'keep';
        const nextSemanticDecision = action === 'exclude' ? 'remove' : 'keep';
        const reasonSuffix = match.entry.reason
            ? `: ${match.entry.reason}`
            : ` (${action})`;
        const nextReason = `Manual review override${reasonSuffix}`;

        summary.appliedOverrides += 1;

        if (action === 'exclude') {
            summary.excluded += 1;
        } else {
            summary.kept += 1;
        }

        record?.(
            'info',
            'manual-review',
            `${decision.fileName}: applied manual override ${action} (${match.matchType})`
        );

        return {
            ...decision,
            decision: nextDecision,
            reason: nextReason,
            decisionOrigin: 'manual-review',
            finalSemanticDecision: nextSemanticDecision,
            finalConfidence: 'high',
            finalDecisionOrigin: 'manual-review',
            finalReasons: [nextReason],
            requiresReview: false,
            requiresDeepCheck: false,
            deepCheckStatus: decision.deepCheckStatus === 'skipped' ? decision.deepCheckStatus : 'manual-override',
            manualReviewKey: subject.key,
            manualOverrideAction: action,
            manualOverrideReason: match.entry.reason || null,
            manualOverrideUpdatedAt: match.entry.updatedAt || null
        };
    });

    return {
        decisions: nextDecisions,
        summary
    };
}


const manualReviewOverridesApi = {
    createManualReviewKey,
    createManualReviewSubject,
    resolveReviewOverridesPath,
    loadManualReviewOverrides,
    findManualReviewOverride,
    setManualReviewOverride,
    confirmManualReviewOverride,
    removeManualReviewOverride,
    applyManualReviewOverrides
};

export default manualReviewOverridesApi;
