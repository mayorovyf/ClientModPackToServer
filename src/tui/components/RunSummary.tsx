import React from 'react';
import { Box, Text } from 'ink';
import { Spinner, StatusMessage } from '@inkjs/ui';

import { useT } from '../i18n/use-t.js';
import type { RunSessionState } from '../state/app-state.js';
import { useScrollOffset } from '../hooks/use-scroll-offset.js';

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
    compact,
    eventLimit,
    isFocused,
    height
}: {
    session: RunSessionState;
    compact: boolean;
    eventLimit: number;
    isFocused: boolean;
    height: number;
}): React.JSX.Element {
    const t = useT();
    const reviewCount = session.lastReport?.arbiter?.summary.finalDecisions.review ?? 0;
    const keptCount = session.lastReport?.stats.kept ?? 0;
    const excludedCount = session.lastReport?.stats.excluded ?? 0;
    const validationStatus = session.lastReport?.validation?.status ?? t('common.placeholder.na');
    const visibleEventLimit = Math.max(1, Math.min(eventLimit, Math.max(height - 15, 1)));
    const { offset, hasOverflow } = useScrollOffset({
        itemCount: session.events.length,
        viewportSize: visibleEventLimit,
        enabled: isFocused
    });
    const visibleEvents = session.events.slice(offset, offset + visibleEventLimit);

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
                    <StatusMessage variant={getStatusVariant(session.status)}>
                        {session.status === 'running'
                            ? t('runSummary.status.running')
                            : session.status === 'succeeded'
                                ? t('runSummary.status.succeeded')
                                : session.status === 'failed'
                                    ? t('runSummary.status.failed', { error: session.lastError || t('common.value.unknown') })
                                    : t('runSummary.status.idle')}
                    </StatusMessage>
                </Box>
                {session.status === 'running' ? (
                    <Box marginTop={1} minWidth={0}>
                        <Spinner label={session.currentStage ? t('runSummary.spinner.stage', { stage: session.currentStage }) : t('runSummary.spinner.starting')} />
                    </Box>
                ) : null}
                <Box marginTop={1} minWidth={0}>
                    <Text wrap="wrap">{`${t('runSummary.runId')}: ${session.runId || t('common.placeholder.na')}`}</Text>
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
                    <Text wrap="wrap">{`${t('runSummary.report')}: ${session.reportPaths.jsonReportPath || t('common.placeholder.na')}`}</Text>
                    <Text wrap="wrap">{`${t('runSummary.summary')}: ${session.reportPaths.summaryPath || t('common.placeholder.na')}`}</Text>
                </Box>
            </Box>
            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">{t('runSummary.events.title')}</Text>
                {hasOverflow ? (
                    <Text dimColor wrap="truncate">
                        {t('runSummary.events.scroll', {
                            start: offset + 1,
                            end: Math.min(offset + visibleEvents.length, session.events.length),
                            total: session.events.length
                        })}
                    </Text>
                ) : null}
                {visibleEvents.map((event) => (
                    <Text key={`${event.timestamp}-${event.type}`} dimColor wrap="wrap">
                        {event.type}
                    </Text>
                ))}
                {visibleEvents.length === 0 ? <Text dimColor wrap="wrap">{t('runSummary.events.empty')}</Text> : null}
            </Box>
        </Box>
    );
}
