import React, { useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

import type { RunPreflightCheck, RunPreflightSummary } from '../state/run-preflight.js';

function getVisibleWindow(total: number, selectedIndex: number, maxVisible: number): { start: number; end: number } {
    if (maxVisible >= total) {
        return { start: 0, end: total };
    }

    const half = Math.floor(maxVisible / 2);
    let start = Math.max(0, selectedIndex - half);
    let end = start + maxVisible;

    if (end > total) {
        end = total;
        start = Math.max(0, end - maxVisible);
    }

    return { start, end };
}

function getSeverityColor(severity: RunPreflightCheck['severity']): 'greenBright' | 'yellow' | 'redBright' {
    switch (severity) {
        case 'error':
            return 'redBright';
        case 'warning':
            return 'yellow';
        case 'ok':
        default:
            return 'greenBright';
    }
}

function getSeverityLabel(severity: RunPreflightCheck['severity']): string {
    switch (severity) {
        case 'error':
            return 'BLOCK';
        case 'warning':
            return 'WARN';
        case 'ok':
        default:
            return 'OK';
    }
}

export function BuildPreflightScreen({
    checks,
    summary,
    selectedCheckId,
    onSelectedCheckChange,
    isFocused,
    height
}: {
    checks: RunPreflightCheck[];
    summary: RunPreflightSummary;
    selectedCheckId: string;
    onSelectedCheckChange: (checkId: string) => void;
    isFocused: boolean;
    height: number;
}): React.JSX.Element {
    const selectedIndex = Math.max(checks.findIndex((check) => check.id === selectedCheckId), 0);

    useInput((_input, key) => {
        if (!isFocused || checks.length === 0) {
            return;
        }

        if (key.upArrow) {
            const nextIndex = selectedIndex <= 0 ? checks.length - 1 : selectedIndex - 1;
            onSelectedCheckChange(checks[nextIndex]!.id);
            return;
        }

        if (key.downArrow) {
            const nextIndex = selectedIndex >= checks.length - 1 ? 0 : selectedIndex + 1;
            onSelectedCheckChange(checks[nextIndex]!.id);
        }
    });

    const contentLines = Math.max(6, height - 4);
    const headerLines = 4;
    const viewportLines = Math.max(2, contentLines - headerLines);
    const linesPerCheck = 2;
    const visibleCheckCount = Math.max(1, Math.floor(viewportLines / linesPerCheck));
    const listHeight = visibleCheckCount * linesPerCheck;
    const windowRange = useMemo(
        () => getVisibleWindow(checks.length, selectedIndex, visibleCheckCount),
        [checks.length, selectedIndex, visibleCheckCount]
    );
    const visibleChecks = checks.slice(windowRange.start, windowRange.end);

    return (
        <Box
            flexDirection="column"
            justifyContent="space-between"
            width="100%"
            height={height}
            borderStyle="round"
            borderColor={isFocused ? 'green' : 'yellow'}
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Box flexDirection="column" minWidth={0}>
                <Text color="yellowBright">Preflight</Text>
                <Text dimColor wrap="truncate">
                    {`Checks ${windowRange.start + 1}-${windowRange.end} of ${checks.length}`}
                </Text>
                <Text dimColor wrap="truncate">
                    {`OK ${summary.ok} | WARN ${summary.warnings} | BLOCK ${summary.errors}`}
                </Text>
            </Box>

            <Box marginTop={1} flexDirection="column" height={listHeight} minWidth={0}>
                {visibleChecks.map((check, index) => {
                    const actualIndex = windowRange.start + index;
                    const isSelected = actualIndex === selectedIndex;

                    return (
                        <Box key={check.id} flexDirection="column" minWidth={0}>
                            <Box width="100%" minWidth={0}>
                                <Box flexDirection="row" flexGrow={1} minWidth={0}>
                                    <Box width={2} minWidth={2}>
                                        <Text color={isSelected ? 'greenBright' : 'white'}>
                                            {isSelected ? '>' : ' '}
                                        </Text>
                                    </Box>
                                    <Box flexGrow={1} minWidth={0}>
                                        <Text color={isSelected ? 'greenBright' : 'white'} wrap="truncate">
                                            {check.title}
                                        </Text>
                                    </Box>
                                </Box>
                                <Box marginLeft={1} flexShrink={0}>
                                    <Text color={getSeverityColor(check.severity)} wrap="truncate">
                                        {getSeverityLabel(check.severity)}
                                    </Text>
                                </Box>
                            </Box>
                            <Box paddingLeft={2} minWidth={0}>
                                <Text dimColor wrap="truncate">{check.summary}</Text>
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}
