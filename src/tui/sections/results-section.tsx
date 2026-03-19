import React from 'react';

import { ReportsDetails } from '../components/ReportsDetails.js';
import { ReviewDetails } from '../components/ReviewDetails.js';
import { RunSummary } from '../components/RunSummary.js';
import { ValidationDetails } from '../components/ValidationDetails.js';
import { BuildValidationScreen } from '../screens/BuildValidationScreen.js';
import { ReportsScreen } from '../screens/ReportsScreen.js';
import { ReviewScreen } from '../screens/ReviewScreen.js';

import type { MessageKey } from '../../i18n/catalog.js';
import type { Translator } from '../../i18n/types.js';
import type { ManualReviewAction } from '../../review/manual-overrides.js';
import type { RunFormState, RunSessionState } from '../state/app-state.js';
import type { ReportHistoryState } from '../state/report-history.js';
import type { ReviewItem } from '../state/review-items.js';
import type { SectionDefinition, SectionNoticeState } from './types.js';

export function createResultsSection({
    t,
    form,
    session,
    compact,
    reportHistory,
    selectedReportRunId,
    selectedReportEntry,
    onSelectedReportRunIdChange,
    reviewItems,
    selectedReviewItem,
    selectedReviewItemId,
    onSelectedReviewItemIdChange,
    onSaveReviewOverride,
    onClearReviewOverride,
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
    onSelectedReportRunIdChange: (runId: string) => void;
    reviewItems: ReviewItem[];
    selectedReviewItem: ReviewItem | null;
    selectedReviewItemId: string;
    onSelectedReviewItemIdChange: (itemId: string) => void;
    onSaveReviewOverride: (action: ManualReviewAction) => void;
    onClearReviewOverride: () => void;
    reviewOverridesPath: string;
    reviewNotice: SectionNoticeState | null;
}): SectionDefinition<'results'> {
    return {
        id: 'results',
        label: t('nav.results.label'),
        defaultPage: 'overview',
        pages: [
            {
                id: 'overview',
                label: t('page.results.overview'),
                chromeColor: 'green',
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <RunSummary
                        session={session}
                        compact={compact}
                        eventLimit={12}
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
                getStatusMessage: () => selectedReportEntry
                    ? t('section.results.overview.latest', { runId: selectedReportEntry.runId })
                    : t('section.results.overview.empty')
            },
            {
                id: 'validation',
                label: t('page.results.validation'),
                chromeColor: 'yellow',
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <BuildValidationScreen
                        form={form}
                        session={session}
                        isFocused={isContentFocused}
                        height={contentHeight}
                    />
                ),
                renderDetails: ({ detailsHeight }) => (
                    <ValidationDetails
                        form={form}
                        session={session}
                        height={detailsHeight}
                    />
                ),
                getStatusMessage: () => {
                    const validationStatus = session.lastReport?.validation?.status || null;

                    if (validationStatus) {
                        return t('section.build.validation.latestStatus', { status: validationStatus });
                    }

                    return form.validationMode === 'off'
                        ? t('section.build.validation.disabled')
                        : t('section.build.validation.none');
                }
            },
            {
                id: 'reports',
                label: t('page.results.reports'),
                chromeColor: 'magenta',
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
                id: 'review',
                label: t('page.results.review'),
                chromeColor: 'red',
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <ReviewScreen
                        items={reviewItems}
                        selectedItemId={selectedReviewItemId}
                        onSelectedItemChange={onSelectedReviewItemIdChange}
                        onSaveOverride={onSaveReviewOverride}
                        onClearOverride={onClearReviewOverride}
                        isFocused={isContentFocused}
                        height={contentHeight}
                    />
                ),
                renderDetails: ({ detailsHeight, isDetailsFocused }) => (
                    <ReviewDetails
                        item={selectedReviewItem}
                        overridesPath={reviewOverridesPath}
                        notice={reviewNotice}
                        isFocused={isDetailsFocused}
                        height={detailsHeight}
                    />
                ),
                getStatusMessage: () => reviewItems.length > 0
                    ? t('section.review.status.shortcuts')
                    : t('section.review.status.empty')
            }
        ]
    };
}
