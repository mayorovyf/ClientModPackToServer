import type { ManualReviewAction, ManualReviewOverridesFile } from '../../review/manual-overrides.js';
import type { ReportDecisionSummary, RunReport } from '../../types/report.js';
import type { MessageKey } from '../../i18n/catalog.js';
import type { Translator } from '../../i18n/types.js';
import { buildDecisionReviewState } from './review-items.js';

export type ResultModsSortMode = 'name' | 'decision' | 'confidence' | 'loader' | 'origin';

export interface ResultModItem {
    id: string;
    decision: ReportDecisionSummary;
    primaryLabel: string;
    displayName: string | null;
    version: string | null;
    loader: string | null;
    modIds: string[];
    finalDecision: string | null;
    finalConfidence: string | null;
    finalOrigin: string | null;
    buildDecision: string | null;
    arbiterDecision: string | null;
    deepCheckDecision: string | null;
    actionStatus: string | null;
    isDisputed: boolean;
    currentOverrideAction: ManualReviewAction | null;
    currentOverrideConfirmed: boolean;
    lastRunOverrideAction: ManualReviewAction | null;
}

const RESULT_MODS_SORT_ORDER: ResultModsSortMode[] = ['name', 'decision', 'confidence', 'loader', 'origin'];

const DECISION_SORT_RANK: Record<string, number> = {
    review: 0,
    remove: 1,
    exclude: 1,
    keep: 2,
    unknown: 3
};

const CONFIDENCE_SORT_RANK: Record<string, number> = {
    high: 0,
    medium: 1,
    low: 2,
    unknown: 3,
    none: 4
};

const GENERIC_DISPLAY_NAMES = new Set([
    'fabric',
    'forge',
    'neoforge',
    'quilt',
    'mod',
    'minecraft'
]);

function normalizeSortableValue(value: string | null | undefined): string {
    return String(value || '').trim().toLowerCase();
}

function getDecisionRank(value: string | null | undefined): number {
    return DECISION_SORT_RANK[normalizeSortableValue(value)] ?? 99;
}

function getConfidenceRank(value: string | null | undefined): number {
    return CONFIDENCE_SORT_RANK[normalizeSortableValue(value)] ?? 99;
}

function trimCandidate(value: string | null | undefined): string | null {
    const trimmed = String(value || '').trim();
    return trimmed.length > 0 ? trimmed : null;
}

function isGenericDisplayName(value: string | null | undefined): boolean {
    const normalized = normalizeSortableValue(value);

    if (!normalized) {
        return true;
    }

    return GENERIC_DISPLAY_NAMES.has(normalized);
}

function getNonGenericCandidate(value: string | null | undefined): string | null {
    const trimmed = trimCandidate(value);

    if (!trimmed || isGenericDisplayName(trimmed)) {
        return null;
    }

    return trimmed;
}

function toTitleCase(value: string): string {
    return value
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function createFileStemLabel(fileName: string): string {
    const withoutExtension = fileName.replace(/\.(jar|zip)$/i, '');
    const firstVersionSeparator = withoutExtension.search(/[-+_](?:v?\d)/i);
    const baseCandidate = firstVersionSeparator > 0
        ? withoutExtension.slice(0, firstVersionSeparator)
        : withoutExtension;
    const withoutLoaderSuffix = baseCandidate.replace(/[-+_](fabric|forge|neoforge|quilt)$/i, '');
    const words = withoutLoaderSuffix
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_+.-]+/g, ' ')
        .trim();

    return words ? toTitleCase(words) : fileName;
}

function resolvePrimaryLabel(decision: ReportDecisionSummary): string {
    const manifestHints = decision.descriptor?.manifestHints || null;
    const specificationTitle = getNonGenericCandidate(manifestHints?.['Specification-Title']);
    const implementationTitle = getNonGenericCandidate(manifestHints?.['Implementation-Title']);

    return getNonGenericCandidate(decision.displayName)
        || getNonGenericCandidate(decision.descriptor?.displayName)
        || specificationTitle
        || implementationTitle
        || createFileStemLabel(decision.fileName);
}

function compareByName(left: ResultModItem, right: ResultModItem): number {
    const leftName = normalizeSortableValue(left.primaryLabel);
    const rightName = normalizeSortableValue(right.primaryLabel);
    return leftName.localeCompare(rightName) || left.decision.fileName.localeCompare(right.decision.fileName);
}

function compareResultMods(left: ResultModItem, right: ResultModItem, sortMode: ResultModsSortMode): number {
    switch (sortMode) {
        case 'decision':
            return getDecisionRank(left.finalDecision) - getDecisionRank(right.finalDecision)
                || compareByName(left, right);
        case 'confidence':
            return getConfidenceRank(left.finalConfidence) - getConfidenceRank(right.finalConfidence)
                || compareByName(left, right);
        case 'loader':
            return normalizeSortableValue(left.loader).localeCompare(normalizeSortableValue(right.loader))
                || compareByName(left, right);
        case 'origin':
            return normalizeSortableValue(left.finalOrigin).localeCompare(normalizeSortableValue(right.finalOrigin))
                || compareByName(left, right);
        case 'name':
        default:
            return compareByName(left, right);
    }
}

export function cycleResultModsSortMode(currentValue: ResultModsSortMode): ResultModsSortMode {
    const currentIndex = RESULT_MODS_SORT_ORDER.indexOf(currentValue);
    return RESULT_MODS_SORT_ORDER[(currentIndex + 1) % RESULT_MODS_SORT_ORDER.length] ?? 'name';
}

export function getResultModsSortLabel(
    sortMode: ResultModsSortMode,
    t: Translator<MessageKey>
): string {
    switch (sortMode) {
        case 'decision':
            return t('screen.mods.sort.decision');
        case 'confidence':
            return t('screen.mods.sort.confidence');
        case 'loader':
            return t('screen.mods.sort.loader');
        case 'origin':
            return t('screen.mods.sort.origin');
        case 'name':
        default:
            return t('screen.mods.sort.name');
    }
}

function createResultModItem(
    decision: ReportDecisionSummary,
    overrides: ManualReviewOverridesFile
): ResultModItem {
    const reviewState = buildDecisionReviewState(decision, overrides);
    const currentOverrideAction = reviewState.currentOverrideAction;
    const finalDecision = currentOverrideAction === 'keep'
        ? 'keep'
        : currentOverrideAction === 'exclude'
            ? 'remove'
            : decision.finalSemanticDecision || decision.arbiterDecision || null;
    const finalOrigin = currentOverrideAction
        ? 'manual-review'
        : decision.finalDecisionOrigin || decision.decisionOrigin || null;
    const modIds = decision.modIds || decision.descriptor?.modIds || [];
    const isDisputed = currentOverrideAction
        ? !reviewState.isConfirmed
        : Boolean(decision.requiresReview || decision.finalSemanticDecision === 'review');

    return {
        id: `file:${decision.fileName}`,
        decision,
        primaryLabel: resolvePrimaryLabel(decision),
        displayName: decision.displayName || decision.descriptor?.displayName || null,
        version: decision.descriptor?.version || null,
        loader: decision.descriptor?.loader || null,
        modIds,
        finalDecision,
        finalConfidence: currentOverrideAction ? 'high' : decision.finalConfidence || decision.arbiterConfidence || null,
        finalOrigin,
        buildDecision: currentOverrideAction || decision.decision || null,
        arbiterDecision: decision.arbiterDecision || null,
        deepCheckDecision: decision.deepCheckDecision || null,
        actionStatus: decision.actionStatus || null,
        isDisputed,
        currentOverrideAction,
        currentOverrideConfirmed: reviewState.isConfirmed,
        lastRunOverrideAction: reviewState.lastRunOverrideAction
    };
}

export function buildResultModItems({
    report,
    overrides,
    disputedOnly,
    sortMode
}: {
    report: RunReport | null;
    overrides?: ManualReviewOverridesFile | null;
    disputedOnly: boolean;
    sortMode: ResultModsSortMode;
}): ResultModItem[] {
    const decisions = report?.decisions || [];
    const effectiveOverrides: ManualReviewOverridesFile = overrides || {
        version: 1,
        updatedAt: '',
        entries: []
    };
    const items = decisions.map((decision) => createResultModItem(decision, effectiveOverrides));
    const filteredItems = disputedOnly ? items.filter((item) => item.isDisputed) : items;

    return [...filteredItems].sort((left, right) => compareResultMods(left, right, sortMode));
}
