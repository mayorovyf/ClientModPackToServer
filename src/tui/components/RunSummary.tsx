import React from 'react';
import { Box, Text } from 'ink';
import { Spinner, StatusMessage } from '@inkjs/ui';

import type { RunSessionState } from '../state/app-state.js';

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
    height
}: {
    session: RunSessionState;
    compact: boolean;
    eventLimit: number;
    height: number;
}): React.JSX.Element {
    const reviewCount = session.lastReport?.arbiter?.summary.finalDecisions.review ?? 0;
    const keptCount = session.lastReport?.stats.kept ?? 0;
    const excludedCount = session.lastReport?.stats.excluded ?? 0;
    const validationStatus = session.lastReport?.validation?.status ?? 'n/a';

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
                <Text color="greenBright" wrap="truncate">Последний запуск</Text>
                <Box marginTop={1} minWidth={0}>
                    <StatusMessage variant={getStatusVariant(session.status)}>
                        {session.status === 'running'
                            ? 'Pipeline выполняется'
                            : session.status === 'succeeded'
                                ? 'Последний запуск завершён успешно'
                                : session.status === 'failed'
                                    ? `Запуск завершился ошибкой: ${session.lastError || 'unknown'}`
                                    : 'Запуск ещё не выполнялся'}
                    </StatusMessage>
                </Box>
                {session.status === 'running' ? (
                    <Box marginTop={1} minWidth={0}>
                        <Spinner label={session.currentStage ? `Этап: ${session.currentStage}` : 'Запуск backend'} />
                    </Box>
                ) : null}
                <Box marginTop={1} minWidth={0}>
                    <Text wrap="wrap">Run ID: {session.runId || 'n/a'}</Text>
                </Box>
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <StatPill label={compact ? 'KEEP' : 'KEPT'} value={keptCount} backgroundColor="green" />
                    <StatPill label={compact ? 'EXCL' : 'EXCLUDED'} value={excludedCount} backgroundColor="red" />
                    <StatPill label="REVIEW" value={reviewCount} backgroundColor="yellow" />
                </Box>
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text wrap="wrap">Validation: {validationStatus}</Text>
                    <Text wrap="wrap">Отчёт: {session.reportPaths.jsonReportPath || 'n/a'}</Text>
                    <Text wrap="wrap">Summary: {session.reportPaths.summaryPath || 'n/a'}</Text>
                </Box>
            </Box>
            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">Последние события</Text>
                {session.events.slice(-eventLimit).map((event) => (
                    <Text key={`${event.timestamp}-${event.type}`} dimColor wrap="wrap">
                        {event.type}
                    </Text>
                ))}
            </Box>
        </Box>
    );
}
