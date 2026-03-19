import React from 'react';

import { ReportsDetails } from '../components/ReportsDetails.js';
import { ResultModsDetails } from '../components/ResultModsDetails.js';
import { ValidationDetails } from '../components/ValidationDetails.js';
import { BuildValidationScreen } from '../screens/BuildValidationScreen.js';
import { ResultModsScreen } from '../screens/ResultModsScreen.js';
import { ReportsScreen } from '../screens/ReportsScreen.js';

import type { MessageKey } from '../../i18n/catalog.js';
import type { Translator } from '../../i18n/types.js';
import type { ManualReviewAction } from '../../review/manual-overrides.js';
import type { RunReport } from '../../types/report.js';
import type { RunFormState, RunSessionState } from '../state/app-state.js';
import type { ReportHistoryState } from '../state/report-history.js';
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
    onSelectedResultModIdChange,
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
    onSelectedResultModIdChange: (itemId: string) => void;
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
                        count: resultModItems.length,
                        disputed: resultModDisputedCount,
                        filter: resultModsDisputedOnly ? t('screen.mods.filter.disputed') : t('screen.mods.filter.all'),
                        sort: t(`screen.mods.sort.${resultModsSortMode}` as MessageKey)
                    })
                    : t('section.results.mods.empty')
            },
            {
                id: 'validation',
                label: t('page.results.validation'),
                chromeColor: 'yellow',
                frameLabel: selectedRunLabel,
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <BuildValidationScreen
                        form={form}
                        session={session}
                        report={selectedReport}
                        isFocused={isContentFocused}
                        height={contentHeight}
                    />
                ),
                renderDetails: ({ detailsHeight }) => (
                    <ValidationDetails
                        form={form}
                        session={session}
                        report={selectedReport}
                        height={detailsHeight}
                    />
                ),
                getStatusMessage: () => {
                    const validationStatus = selectedReport?.validation?.status || null;

                    if (validationStatus) {
                        return t('section.build.validation.latestStatus', { status: validationStatus });
                    }

                    return form.validationMode === 'off'
                        ? t('section.build.validation.disabled')
                        : t('section.build.validation.none');
                }
            },
        ]
    };
}
