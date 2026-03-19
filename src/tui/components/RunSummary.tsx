import React from 'react';
import { Box, Text } from 'ink';
import { Spinner } from '@inkjs/ui';

import { useT } from '../i18n/use-t.js';
import type { RunSessionState } from '../state/app-state.js';
import { useScrollOffset } from '../hooks/use-scroll-offset.js';
import type { RunReport } from '../../types/report.js';
import type { ReportHistoryEntry } from '../state/report-history.js';

function getEventKey(event: RunReport['events'][number] | RunSessionState['events'][number]): string {
    return 'type' in event ? event.type : `${event.kind}:${event.message}`;
}

function getEventLabel(event: RunReport['events'][number] | RunSessionState['events'][number]): string {
    if ('type' in event) {
        const stage = typeof event.payload?.stage === 'string' ? event.payload.stage : null;

        if (stage && (event.type === 'stage.started' || event.type === 'stage.completed')) {
            return `${event.type}: ${stage}`;
        }

        return event.type;
    }

    return event.kind;
}

function getStatusColor(status: RunSessionState['status']): 'cyanBright' | 'greenBright' | 'redBright' | 'yellow' {
    switch (status) {
        case 'running':
            return 'cyanBright';
        case 'succeeded':
            return 'greenBright';
        case 'failed':
            return 'redBright';
        default:
            return 'yellow';
    }
}

function getStatusText(
    status: RunSessionState['status'],
    t: ReturnType<typeof useT>,
    errorText: string
): string {
    switch (status) {
        case 'running':
            return t('runSummary.status.running');
        case 'succeeded':
            return t('runSummary.status.succeeded');
        case 'failed':
            return t('runSummary.status.failed', { error: errorText });
        default:
            return t('runSummary.status.idle');
    }
}

function formatTail(value: string | null, maxLength = 38): string {
    const normalized = String(value || '').trim();

    if (!normalized) {
        return 'n/a';
    }

    if (normalized.length <= maxLength) {
        return normalized;
    }

    if (normalized.includes('\\') || normalized.includes('/')) {
        return `...${normalized.slice(-(maxLength - 3))}`;
    }

    return `${normalized.slice(0, maxLength - 3)}...`;
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
    const contentHeight = Math.max(6, height - 4);
    const summaryHeight = summaryStatus === 'running' && !isHistorical ? 8 : 7;
    const eventsHeight = Math.max(3, contentHeight - summaryHeight);
    const visibleEventLimit = Math.max(1, Math.min(eventLimit, Math.max(eventsHeight - 2, 1)));
    const { offset, hasOverflow } = useScrollOffset({
        itemCount: events.length,
        viewportSize: visibleEventLimit,
        enabled: isFocused
    });
    const visibleEvents = events.slice(offset, offset + visibleEventLimit);

    return (
        <Box
            flexDirection="column"
            width="100%"
            height={height}
            borderStyle="round"
            borderColor="green"
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Box flexDirection="column" height={summaryHeight} minWidth={0}>
                <Text color="greenBright" wrap="truncate">{t('runSummary.title')}</Text>
                <Text color={getStatusColor(summaryStatus)} wrap="truncate">
                    {getStatusText(summaryStatus, t, isHistorical ? historicalError : (session.lastError || t('common.value.unknown')))}
                </Text>
                {summaryStatus === 'running' && !isHistorical ? (
                    <Box minWidth={0}>
                        <Spinner label={session.currentStage ? t('runSummary.spinner.stage', { stage: session.currentStage }) : t('runSummary.spinner.starting')} />
                    </Box>
                ) : null}
                <Text wrap="truncate">{`${t('runSummary.runId')}: ${runId || t('common.placeholder.na')}`}</Text>
                <Text wrap="truncate">
                    {`${compact ? t('runSummary.stat.keep.short') : t('runSummary.stat.keep.full')} ${keptCount} | ${compact ? t('runSummary.stat.exclude.short') : t('runSummary.stat.exclude.full')} ${excludedCount} | ${t('runSummary.stat.review')} ${reviewCount}`}
                </Text>
                <Text wrap="truncate">{`${t('runSummary.validation')}: ${validationStatus}`}</Text>
                <Text wrap="truncate">{`${t('runSummary.report')}: ${formatTail(reportPath, 34)}`}</Text>
                <Text wrap="truncate">{`${t('runSummary.summary')}: ${formatTail(summaryPath, 34)}`}</Text>
            </Box>
            <Box flexDirection="column" height={eventsHeight} minWidth={0}>
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
                    <Text key={`${event.timestamp}-${getEventKey(event)}`} dimColor wrap="truncate">
                        {getEventLabel(event)}
                    </Text>
                ))}
                {visibleEvents.length === 0 ? <Text dimColor wrap="wrap">{t('runSummary.events.empty')}</Text> : null}
            </Box>
        </Box>
    );
}
