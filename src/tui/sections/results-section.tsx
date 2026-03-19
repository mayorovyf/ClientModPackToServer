import React from 'react';

import { ReportsDetails } from '../components/ReportsDetails.js';
import { ResultCompareDetails } from '../components/ResultCompareDetails.js';
import { ResultModsDetails } from '../components/ResultModsDetails.js';
import { ResultProblemsDetails } from '../components/ResultProblemsDetails.js';
import { ReportsScreen } from '../screens/ReportsScreen.js';
import { ResultCompareScreen } from '../screens/ResultCompareScreen.js';
import { ResultModsScreen } from '../screens/ResultModsScreen.js';
import { ResultProblemsScreen } from '../screens/ResultProblemsScreen.js';

import type { MessageKey } from '../../i18n/catalog.js';
import type { Translator } from '../../i18n/types.js';
import type { ManualReviewAction } from '../../review/manual-overrides.js';
import type { RunReport } from '../../types/report.js';
import type { RunFormState, RunSessionState } from '../state/app-state.js';
import type { ReportHistoryState } from '../state/report-history.js';
import type { ResultCompareItem, ResultCompareSummary } from '../state/result-compare.js';
import type { ResultProblemItem, ResultProblemsSummary } from '../state/result-problems.js';
import type { ResultModItem, ResultModsSortMode } from '../state/results-mods.js';
import type { DecisionReviewState } from '../state/review-items.js';
import type { SectionDefinition, SectionNoticeState } from './types.js';

export function createResultsSection({
    t,
    form,
    session,
    compact,
    reportHistory,
    selectedReportRunId,
    selectedReportEntry,
    selectedReport,
    allResultModItems,
    resultModItems,
    resultModDisputedCount,
    selectedResultMod,
    selectedResultModReviewState,
    selectedResultModId,
    resultProblems,
    resultProblemsSummary,
    selectedResultProblem,
    selectedResultProblemId,
    resultCompareItems,
    resultCompareSummary,
    selectedResultCompareItem,
    selectedResultCompareItemId,
    onSelectedResultModIdChange,
    onSelectedResultProblemIdChange,
    onSelectedResultCompareItemIdChange,
    onSaveSelectedResultModOverride,
    onConfirmSelectedResultModOverride,
    onClearSelectedResultModOverride,
    resultModsDisputedOnly,
    onResultModsDisputedOnlyChange,
    resultModsSortMode,
    onResultModsSortModeChange,
    onSelectedReportRunIdChange,
    reviewOverridesPath,
    reviewNotice
}: {
    t: Translator<MessageKey>;
    form: RunFormState;
    session: RunSessionState;
    compact: boolean;
    reportHistory: ReportHistoryState;
    selectedReportRunId: string;
    selectedReportEntry: ReportHistoryState['entries'][number] | null;
    selectedReport: RunReport | null;
    allResultModItems: ResultModItem[];
    resultModItems: ResultModItem[];
    resultModDisputedCount: number;
    selectedResultMod: ResultModItem | null;
    selectedResultModReviewState: DecisionReviewState | null;
    selectedResultModId: string;
    resultProblems: ResultProblemItem[];
    resultProblemsSummary: ResultProblemsSummary | null;
    selectedResultProblem: ResultProblemItem | null;
    selectedResultProblemId: string;
    resultCompareItems: ResultCompareItem[];
    resultCompareSummary: ResultCompareSummary | null;
    selectedResultCompareItem: ResultCompareItem | null;
    selectedResultCompareItemId: string;
    onSelectedResultModIdChange: (itemId: string) => void;
    onSelectedResultProblemIdChange: (itemId: string) => void;
    onSelectedResultCompareItemIdChange: (itemId: string) => void;
    onSaveSelectedResultModOverride: (action: ManualReviewAction) => void;
    onConfirmSelectedResultModOverride: () => void;
    onClearSelectedResultModOverride: () => void;
    resultModsDisputedOnly: boolean;
    onResultModsDisputedOnlyChange: (nextValue: boolean) => void;
    resultModsSortMode: ResultModsSortMode;
    onResultModsSortModeChange: (nextValue: ResultModsSortMode) => void;
    onSelectedReportRunIdChange: (runId: string) => void;
    reviewOverridesPath: string;
    reviewNotice: SectionNoticeState | null;
}): SectionDefinition<'results'> {
    const selectedRunLabel = selectedReport?.run.runId || selectedReportEntry?.runId || null;
    const effectiveProblemsSummary = resultProblemsSummary || {
        total: 0,
        blocking: 0,
        warnings: 0,
        validation: 0,
        falseRemovals: 0,
        disputedMods: 0
    };

    return {
        id: 'results',
        label: t('nav.results.label'),
        defaultPage: 'reports',
        pages: [
            {
                id: 'reports',
                label: t('page.results.reports'),
                chromeColor: 'magenta',
                frameLabel: selectedRunLabel,
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <ReportsScreen
                        entries={reportHistory.entries}
                        reportRootDir={reportHistory.reportRootDir}
                        loadError={reportHistory.error}
                        selectedRunId={selectedReportRunId}
                        onSelectedRunIdChange={onSelectedReportRunIdChange}
                        isFocused={isContentFocused}
                        height={contentHeight}
                    />
                ),
                renderDetails: ({ detailsHeight, isDetailsFocused }) => (
                    <ReportsDetails
                        entry={selectedReportEntry}
                        reportRootDir={reportHistory.reportRootDir}
                        loadError={reportHistory.error}
                        isFocused={isDetailsFocused}
                        height={detailsHeight}
                    />
                ),
                getStatusMessage: () => reportHistory.error
                    || (reportHistory.entries.length > 0
                        ? t('section.reports.status.count', { count: reportHistory.entries.length })
                        : t('section.reports.status.empty'))
            },
            {
                id: 'overview',
                label: t('page.results.overview'),
                chromeColor: 'green',
                frameLabel: selectedRunLabel,
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <ResultModsScreen
                        items={resultModItems}
                        totalCount={allResultModItems.length}
                        disputedCount={resultModDisputedCount}
                        selectedItemId={selectedResultModId}
                        onSelectedItemChange={onSelectedResultModIdChange}
                        onSaveOverride={onSaveSelectedResultModOverride}
                        onConfirmOverride={onConfirmSelectedResultModOverride}
                        onClearOverride={onClearSelectedResultModOverride}
                        disputedOnly={resultModsDisputedOnly}
                        onDisputedOnlyChange={onResultModsDisputedOnlyChange}
                        sortMode={resultModsSortMode}
                        onSortModeChange={onResultModsSortModeChange}
                        isFocused={isContentFocused}
                        height={contentHeight}
                    />
                ),
                renderDetails: ({ detailsHeight, isDetailsFocused }) => (
                    <ResultModsDetails
                        item={selectedResultMod}
                        reviewState={selectedResultModReviewState}
                        totalCount={resultModItems.length}
                        disputedCount={resultModDisputedCount}
                        disputedOnly={resultModsDisputedOnly}
                        sortMode={resultModsSortMode}
                        reviewOverridesPath={reviewOverridesPath}
                        reviewNotice={reviewNotice}
                        isFocused={isDetailsFocused}
                        height={detailsHeight}
                    />
                ),
                getStatusMessage: () => selectedReportEntry
                    ? t('section.results.mods.selected', {
                        runId: selectedReportEntry.runId,
                        count: allResultModItems.length,
                        disputed: resultModDisputedCount,
                        filter: resultModsDisputedOnly ? t('screen.mods.filter.disputed') : t('screen.mods.filter.all'),
                        sort: t(`screen.mods.sort.${resultModsSortMode}` as MessageKey)
                    })
                    : t('section.results.mods.empty')
            },
            {
                id: 'problems',
                label: t('page.results.problems'),
                chromeColor: 'red',
                frameLabel: selectedRunLabel,
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <ResultProblemsScreen
                        items={resultProblems}
                        summary={effectiveProblemsSummary}
                        selectedItemId={selectedResultProblemId}
                        onSelectedItemChange={onSelectedResultProblemIdChange}
                        isFocused={isContentFocused}
                        height={contentHeight}
                    />
                ),
                renderDetails: ({ detailsHeight, isDetailsFocused }) => (
                    <ResultProblemsDetails
                        item={selectedResultProblem}
                        summary={effectiveProblemsSummary}
                        isFocused={isDetailsFocused}
                        height={detailsHeight}
                    />
                ),
                getStatusMessage: () => t('section.results.problems.selected', {
                    total: effectiveProblemsSummary.total,
                    blocking: effectiveProblemsSummary.blocking,
                    warnings: effectiveProblemsSummary.warnings
                })
            },
            {
                id: 'compare',
                label: t('page.results.compare'),
                chromeColor: 'cyan',
                frameLabel: selectedRunLabel,
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <ResultCompareScreen
                        items={resultCompareItems}
                        summary={resultCompareSummary}
                        selectedItemId={selectedResultCompareItemId}
                        onSelectedItemChange={onSelectedResultCompareItemIdChange}
                        isFocused={isContentFocused}
                        height={contentHeight}
                    />
                ),
                renderDetails: ({ detailsHeight, isDetailsFocused }) => (
                    <ResultCompareDetails
                        item={selectedResultCompareItem}
                        summary={resultCompareSummary}
                        isFocused={isDetailsFocused}
                        height={detailsHeight}
                    />
                ),
                getStatusMessage: () => resultCompareSummary
                    ? t('section.results.compare.selected', {
                        changed: resultCompareSummary.changedMods,
                        baseline: resultCompareSummary.baselineRunId || t('common.placeholder.na')
                    })
                    : t('section.results.compare.empty')
            }
        ]
    };
}
