import React from 'react';
import { Box, Text } from 'ink';
import { Spinner, StatusMessage } from '@inkjs/ui';

import { useT } from '../i18n/use-t.js';
import type { RunSessionState } from '../state/app-state.js';
import { useScrollOffset } from '../hooks/use-scroll-offset.js';
import type { RunReport } from '../../types/report.js';
import type { ReportHistoryEntry } from '../state/report-history.js';

function getEventKey(event: RunReport['events'][number] | RunSessionState['events'][number]): string {
    return 'type' in event ? event.type : `${event.kind}:${event.message}`;
}

function getEventLabel(event: RunReport['events'][number] | RunSessionState['events'][number]): string {
    return 'type' in event ? event.type : event.kind;
}

function getStatusVariant(status: RunSessionState['status']): 'info' | 'success' | 'error' | 'warning' {
    switch (status) {
        case 'running':
            return 'info';
        case 'succeeded':
            return 'success';
        case 'failed':
            return 'error';
        default:
            return 'warning';
    }
}

function StatPill({
    label,
    value,
    backgroundColor
}: {
    label: string;
    value: number;
    backgroundColor: 'green' | 'red' | 'yellow';
}): React.JSX.Element {
    return (
        <Text backgroundColor={backgroundColor} color="black" wrap="truncate">
            {` ${label} ${value} `}
        </Text>
    );
}

export function RunSummary({
    session,
    report = null,
    reportEntry = null,
    compact,
    eventLimit,
    isFocused,
    height
}: {
    session: RunSessionState;
    report?: RunReport | null;
    reportEntry?: ReportHistoryEntry | null;
    compact: boolean;
    eventLimit: number;
    isFocused: boolean;
    height: number;
}): React.JSX.Element {
    const t = useT();
    const sourceReport = report || session.lastReport;
    const isHistorical = Boolean(report);
    const historicalError = sourceReport?.errors[0]?.message || t('common.value.unknown');
    const reviewCount = sourceReport?.arbiter?.summary.finalDecisions.review ?? 0;
    const keptCount = sourceReport?.stats.kept ?? 0;
    const excludedCount = sourceReport?.stats.excluded ?? 0;
    const validationStatus = sourceReport?.validation?.status ?? t('common.placeholder.na');
    const summaryStatus: RunSessionState['status'] = isHistorical
        ? ((sourceReport?.errors.length ?? 0) > 0 ? 'failed' : 'succeeded')
        : session.status;
    const runId = sourceReport?.run.runId || reportEntry?.runId || session.runId;
    const events = isHistorical ? (sourceReport?.events ?? []) : session.events;
    const reportPath = sourceReport?.run.jsonReportPath || reportEntry?.jsonReportPath || session.reportPaths.jsonReportPath;
    const summaryPath = sourceReport?.run.summaryPath || reportEntry?.summaryPath || session.reportPaths.summaryPath;
    const visibleEventLimit = Math.max(1, Math.min(eventLimit, Math.max(height - 15, 1)));
    const { offset, hasOverflow } = useScrollOffset({
        itemCount: events.length,
        viewportSize: visibleEventLimit,
        enabled: isFocused
    });
    const visibleEvents = events.slice(offset, offset + visibleEventLimit);

    return (
        <Box
            flexDirection="column"
            justifyContent="space-between"
            width="100%"
            height={height}
            borderStyle="round"
            borderColor="green"
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Box flexDirection="column" minWidth={0}>
                <Text color="greenBright" wrap="truncate">{t('runSummary.title')}</Text>
                <Box marginTop={1} minWidth={0}>
                    <StatusMessage variant={getStatusVariant(summaryStatus)}>
                        {summaryStatus === 'running'
                            ? t('runSummary.status.running')
                            : summaryStatus === 'succeeded'
                                ? t('runSummary.status.succeeded')
                                : summaryStatus === 'failed'
                                    ? t('runSummary.status.failed', { error: isHistorical ? historicalError : (session.lastError || t('common.value.unknown')) })
                                    : t('runSummary.status.idle')}
                    </StatusMessage>
                </Box>
                {summaryStatus === 'running' && !isHistorical ? (
                    <Box marginTop={1} minWidth={0}>
                        <Spinner label={session.currentStage ? t('runSummary.spinner.stage', { stage: session.currentStage }) : t('runSummary.spinner.starting')} />
                    </Box>
                ) : null}
                <Box marginTop={1} minWidth={0}>
                    <Text wrap="wrap">{`${t('runSummary.runId')}: ${runId || t('common.placeholder.na')}`}</Text>
                </Box>
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <StatPill
                        label={compact ? t('runSummary.stat.keep.short') : t('runSummary.stat.keep.full')}
                        value={keptCount}
                        backgroundColor="green"
                    />
                    <StatPill
                        label={compact ? t('runSummary.stat.exclude.short') : t('runSummary.stat.exclude.full')}
                        value={excludedCount}
                        backgroundColor="red"
                    />
                    <StatPill label={t('runSummary.stat.review')} value={reviewCount} backgroundColor="yellow" />
                </Box>
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text wrap="wrap">{`${t('runSummary.validation')}: ${validationStatus}`}</Text>
                    <Text wrap="wrap">{`${t('runSummary.report')}: ${reportPath || t('common.placeholder.na')}`}</Text>
                    <Text wrap="wrap">{`${t('runSummary.summary')}: ${summaryPath || t('common.placeholder.na')}`}</Text>
                </Box>
            </Box>
            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">{t('runSummary.events.title')}</Text>
                {hasOverflow ? (
                    <Text dimColor wrap="truncate">
                        {t('runSummary.events.scroll', {
                            start: offset + 1,
                            end: Math.min(offset + visibleEvents.length, events.length),
                            total: events.length
                        })}
                    </Text>
                ) : null}
                {visibleEvents.map((event) => (
                    <Text key={`${event.timestamp}-${getEventKey(event)}`} dimColor wrap="wrap">
                        {getEventLabel(event)}
                    </Text>
                ))}
                {visibleEvents.length === 0 ? <Text dimColor wrap="wrap">{t('runSummary.events.empty')}</Text> : null}
            </Box>
        </Box>
    );
}
