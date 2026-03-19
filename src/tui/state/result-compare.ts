import type { RunReport } from '../../types/report.js';
import type { ReportHistoryEntry } from './report-history.js';
import type { ResultModItem } from './results-mods.js';

export type ResultCompareChangeKind = 'added' | 'removed' | 'decision' | 'manual' | 'disputed' | 'origin' | 'confidence';

export interface ResultCompareItem {
    id: string;
    fileName: string;
    primaryLabel: string;
    changeKind: ResultCompareChangeKind;
    currentDecision: string | null;
    baselineDecision: string | null;
    currentConfidence: string | null;
    baselineConfidence: string | null;
    currentOrigin: string | null;
    baselineOrigin: string | null;
    currentOverrideAction: string | null;
    baselineOverrideAction: string | null;
    currentIsDisputed: boolean;
    baselineIsDisputed: boolean;
    currentFileName: string | null;
    baselineFileName: string | null;
}

export interface ResultCompareSummary {
    currentRunId: string | null;
    baselineRunId: string | null;
    changedMods: number;
    addedMods: number;
    removedMods: number;
    decisionChanges: number;
    keepDelta: number;
    removeDelta: number;
    disputedDelta: number;
    issueDelta: number;
    falseRemovalDelta: number;
}

function countDecision(items: ResultModItem[], decision: string): number {
    return items.filter((item) => item.finalDecision === decision).length;
}

function getCompareChangeRank(changeKind: ResultCompareChangeKind): number {
    switch (changeKind) {
        case 'added':
        case 'removed':
            return 0;
        case 'decision':
            return 1;
        case 'manual':
            return 2;
        case 'disputed':
            return 3;
        case 'origin':
            return 4;
        case 'confidence':
        default:
            return 5;
    }
}

function getPrimaryChangeKind(currentItem: ResultModItem | null, baselineItem: ResultModItem | null): ResultCompareChangeKind | null {
    if (currentItem && !baselineItem) {
        return 'added';
    }

    if (!currentItem && baselineItem) {
        return 'removed';
    }

    if (!currentItem || !baselineItem) {
        return null;
    }

    if (currentItem.finalDecision !== baselineItem.finalDecision) {
        return 'decision';
    }

    if ((currentItem.currentOverrideAction || null) !== (baselineItem.currentOverrideAction || null)) {
        return 'manual';
    }

    if (currentItem.isDisputed !== baselineItem.isDisputed) {
        return 'disputed';
    }

    if ((currentItem.finalOrigin || null) !== (baselineItem.finalOrigin || null)) {
        return 'origin';
    }

    if ((currentItem.finalConfidence || null) !== (baselineItem.finalConfidence || null)) {
        return 'confidence';
    }

    return null;
}

function compareResultChanges(left: ResultCompareItem, right: ResultCompareItem): number {
    return getCompareChangeRank(left.changeKind) - getCompareChangeRank(right.changeKind)
        || left.primaryLabel.localeCompare(right.primaryLabel)
        || left.fileName.localeCompare(right.fileName);
}

function createResultCompareItem(currentItem: ResultModItem | null, baselineItem: ResultModItem | null): ResultCompareItem | null {
    const changeKind = getPrimaryChangeKind(currentItem, baselineItem);

    if (!changeKind) {
        return null;
    }

    const activeItem = currentItem || baselineItem;

    if (!activeItem) {
        return null;
    }

    return {
        id: `compare:${activeItem.id}`,
        fileName: activeItem.decision.fileName,
        primaryLabel: activeItem.primaryLabel,
        changeKind,
        currentDecision: currentItem?.finalDecision || null,
        baselineDecision: baselineItem?.finalDecision || null,
        currentConfidence: currentItem?.finalConfidence || null,
        baselineConfidence: baselineItem?.finalConfidence || null,
        currentOrigin: currentItem?.finalOrigin || null,
        baselineOrigin: baselineItem?.finalOrigin || null,
        currentOverrideAction: currentItem?.currentOverrideAction || null,
        baselineOverrideAction: baselineItem?.currentOverrideAction || null,
        currentIsDisputed: currentItem?.isDisputed || false,
        baselineIsDisputed: baselineItem?.isDisputed || false,
        currentFileName: currentItem?.decision.fileName || null,
        baselineFileName: baselineItem?.decision.fileName || null
    };
}

export function resolveCompareBaselineEntry(
    entries: ReportHistoryEntry[],
    selectedRunId: string
): ReportHistoryEntry | null {
    if (entries.length <= 1) {
        return null;
    }

    const selectedIndex = entries.findIndex((entry) => entry.runId === selectedRunId);
    const effectiveIndex = selectedIndex >= 0 ? selectedIndex : 0;

    return entries[effectiveIndex + 1] || entries[effectiveIndex - 1] || null;
}

export function buildResultCompareState({
    currentReport,
    baselineReport,
    currentItems,
    baselineItems
}: {
    currentReport: RunReport | null;
    baselineReport: RunReport | null;
    currentItems: ResultModItem[];
    baselineItems: ResultModItem[];
}): {
    items: ResultCompareItem[];
    summary: ResultCompareSummary | null;
} {
    if (!currentReport || !baselineReport) {
        return {
            items: [],
            summary: null
        };
    }

    const currentByFile = new Map(currentItems.map((item) => [item.decision.fileName, item]));
    const baselineByFile = new Map(baselineItems.map((item) => [item.decision.fileName, item]));
    const allFileNames = [...new Set([...currentByFile.keys(), ...baselineByFile.keys()])];
    const items = allFileNames
        .map((fileName) => createResultCompareItem(currentByFile.get(fileName) || null, baselineByFile.get(fileName) || null))
        .filter((item): item is ResultCompareItem => item !== null)
        .sort(compareResultChanges);
    const addedMods = items.filter((item) => item.changeKind === 'added').length;
    const removedMods = items.filter((item) => item.changeKind === 'removed').length;
    const decisionChanges = items.filter((item) => item.changeKind === 'decision').length;

    return {
        items,
        summary: {
            currentRunId: currentReport.run.runId || null,
            baselineRunId: baselineReport.run.runId || null,
            changedMods: items.length,
            addedMods,
            removedMods,
            decisionChanges,
            keepDelta: countDecision(currentItems, 'keep') - countDecision(baselineItems, 'keep'),
            removeDelta: countDecision(currentItems, 'remove') - countDecision(baselineItems, 'remove'),
            disputedDelta: currentItems.filter((item) => item.isDisputed).length - baselineItems.filter((item) => item.isDisputed).length,
            issueDelta: (currentReport.validation?.issues.length || 0) - (baselineReport.validation?.issues.length || 0),
            falseRemovalDelta: (currentReport.validation?.suspectedFalseRemovals.length || 0) - (baselineReport.validation?.suspectedFalseRemovals.length || 0)
        }
    };
}
