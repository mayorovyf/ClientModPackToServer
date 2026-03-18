import React from 'react';
import { Box, Text } from 'ink';

import { useScrollOffset } from '../hooks/use-scroll-offset.js';
import type { RunSessionState } from '../state/app-state.js';

export function ReportsScreen({
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
    const visibleEventLimit = Math.max(1, Math.min(eventLimit, height - 8));
    const { offset, hasOverflow } = useScrollOffset({
        itemCount: session.events.length,
        viewportSize: visibleEventLimit
    });
    const visibleEvents = session.events.slice(offset, offset + visibleEventLimit);

    return (
        <Box
            flexDirection="column"
            justifyContent="space-between"
            width="100%"
            height={height}
            borderStyle="round"
            borderColor="magenta"
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Box flexDirection="column" minWidth={0}>
                <Text color="magentaBright">Отчёты</Text>
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text wrap="truncate">Report dir: {session.reportPaths.reportDir || 'n/a'}</Text>
                    <Text wrap="truncate">JSON report: {session.reportPaths.jsonReportPath || 'n/a'}</Text>
                    <Text wrap="truncate">Summary: {session.reportPaths.summaryPath || 'n/a'}</Text>
                    <Text wrap="truncate">Events log: {session.reportPaths.eventsLogPath || 'n/a'}</Text>
                </Box>
            </Box>
            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan">Последние event types</Text>
                {hasOverflow ? (
                    <Text dimColor wrap="truncate">
                        {`↑/↓ прокрутка | ${offset + 1}-${Math.min(offset + visibleEvents.length, session.events.length)} из ${session.events.length}`}
                    </Text>
                ) : null}
                {visibleEvents.length === 0 ? <Text dimColor wrap="truncate">События ещё не поступали</Text> : null}
                {visibleEvents.map((event) => (
                    <Text key={`${event.timestamp}-${event.type}`} wrap="truncate">
                        {event.type}
                    </Text>
                ))}
            </Box>
        </Box>
    );
}
