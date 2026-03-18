import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';

import type { ReportHistoryEntry } from '../state/report-history.js';

function formatDateTime(value: string | null): string {
    if (!value) {
        return 'n/a';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}.${month} ${hours}:${minutes}`;
}

function createHistorySubtitle(entry: ReportHistoryEntry): string {
    const instanceName = entry.instancePath
        ? entry.instancePath.replace(/[/\\]+$/, '').split(/[/\\]/).at(-1) || 'instance'
        : 'instance';
    const modeLabel = entry.dryRun ? 'dry-run' : (entry.mode || 'build');

    return `${instanceName} | ${modeLabel} | keep ${entry.kept} excl ${entry.excluded} review ${entry.review}`;
}

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

export function ReportsScreen({
    entries,
    reportRootDir,
    loadError,
    selectedRunId,
    onSelectedRunIdChange,
    isFocused,
    height
}: {
    entries: ReportHistoryEntry[];
    reportRootDir: string;
    loadError: string | null;
    selectedRunId: string;
    onSelectedRunIdChange: (runId: string) => void;
    isFocused: boolean;
    height: number;
}): React.JSX.Element {
    const initialSelectedIndex = Math.max(entries.findIndex((entry) => entry.runId === selectedRunId), 0);
    const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);

    useEffect(() => {
        setSelectedIndex(Math.max(entries.findIndex((entry) => entry.runId === selectedRunId), 0));
    }, [entries, selectedRunId]);

    useEffect(() => {
        const activeEntry = entries[selectedIndex] || null;

        if (activeEntry && activeEntry.runId !== selectedRunId) {
            onSelectedRunIdChange(activeEntry.runId);
        }
    }, [entries, onSelectedRunIdChange, selectedIndex, selectedRunId]);

    useInput((_input, key) => {
        if (!isFocused || entries.length <= 1) {
            return;
        }

        if (key.upArrow) {
            setSelectedIndex((current) => (current <= 0 ? entries.length - 1 : current - 1));
            return;
        }

        if (key.downArrow) {
            setSelectedIndex((current) => (current >= entries.length - 1 ? 0 : current + 1));
        }
    });

    const contentLines = Math.max(6, height - 4);
    const headerLines = 4;
    const viewportLines = Math.max(2, contentLines - headerLines);
    const linesPerEntry = 2;
    const visibleEntryCount = Math.max(1, Math.floor(viewportLines / linesPerEntry));
    const windowRange = useMemo(
        () => getVisibleWindow(entries.length, selectedIndex, visibleEntryCount),
        [entries.length, selectedIndex, visibleEntryCount]
    );
    const visibleEntries = entries.slice(windowRange.start, windowRange.end);
    const listHeight = visibleEntryCount * linesPerEntry;

    return (
        <Box
            flexDirection="column"
            justifyContent="space-between"
            width="100%"
            height={height}
            borderStyle="round"
            borderColor={isFocused ? 'green' : 'magenta'}
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Box flexDirection="column" minWidth={0}>
                <Text color="magentaBright">Отчёты</Text>
                <Text dimColor wrap="truncate">{`Корень: ${reportRootDir}`}</Text>
                {entries.length > 0 ? (
                    <Text dimColor wrap="truncate">
                        {`Запуски ${windowRange.start + 1}-${windowRange.end} из ${entries.length}`}
                    </Text>
                ) : (
                    <Text dimColor wrap="truncate">Запуски пока не найдены</Text>
                )}
                {loadError ? <Text color="red" wrap="truncate">{loadError}</Text> : null}
            </Box>

            <Box marginTop={1} flexDirection="column" height={listHeight} minWidth={0}>
                {entries.length === 0 && !loadError ? (
                    <Text dimColor wrap="wrap">
                        После первого завершённого запуска здесь появится список последних отчётов.
                    </Text>
                ) : null}
                {visibleEntries.map((entry, index) => {
                    const actualIndex = windowRange.start + index;
                    const isSelected = actualIndex === selectedIndex;

                    return (
                        <Box key={entry.runId} flexDirection="column" minWidth={0}>
                            <Box width="100%" minWidth={0}>
                                <Box flexDirection="row" flexGrow={1} minWidth={0}>
                                    <Box width={2} minWidth={2}>
                                        <Text color={isSelected ? 'greenBright' : 'white'}>
                                            {isSelected ? '▸' : ' '}
                                        </Text>
                                    </Box>
                                    <Box flexGrow={1} minWidth={0}>
                                        <Text color={isSelected ? 'greenBright' : 'white'} wrap="truncate">
                                            {entry.runId}
                                        </Text>
                                    </Box>
                                </Box>
                                <Box marginLeft={1} flexShrink={0} minWidth={0}>
                                    <Text color={isSelected ? 'cyanBright' : 'gray'} wrap="truncate">
                                        {formatDateTime(entry.completedAt || entry.startedAt)}
                                    </Text>
                                </Box>
                            </Box>
                            <Box paddingLeft={2} minWidth={0}>
                                <Text dimColor wrap="truncate">{createHistorySubtitle(entry)}</Text>
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}
