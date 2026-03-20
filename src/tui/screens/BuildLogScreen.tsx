import React, { useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

import { useT } from '../i18n/use-t.js';
import { getBuildLogStatusLabel } from '../state/build-log.js';

import type { RunSessionState } from '../state/app-state.js';
import type { BuildLogItem } from '../state/build-log.js';

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

function getStatusColor(status: BuildLogItem['status']): 'gray' | 'yellow' | 'greenBright' | 'redBright' | 'cyanBright' {
    switch (status) {
        case 'running':
            return 'cyanBright';
        case 'completed':
            return 'greenBright';
        case 'failed':
            return 'redBright';
        case 'warning':
            return 'yellow';
        case 'pending':
        default:
            return 'gray';
    }
}

function getSessionStatusLabel(status: RunSessionState['status'], t: ReturnType<typeof useT>): string {
    switch (status) {
        case 'running':
            return t('buildLog.state.running');
        case 'succeeded':
            return t('buildLog.state.succeeded');
        case 'failed':
            return t('buildLog.state.failed');
        case 'idle':
        default:
            return t('buildLog.state.idle');
    }
}

function formatTail(value: string | null, maxLength = 24): string {
    const normalized = String(value || '').trim();

    if (!normalized) {
        return 'n/a';
    }

    return normalized.length <= maxLength ? normalized : `...${normalized.slice(-(maxLength - 3))}`;
}

export function BuildLogScreen({
    items,
    selectedItemId,
    onSelectedItemChange,
    session,
    isFocused,
    height
}: {
    items: BuildLogItem[];
    selectedItemId: string;
    onSelectedItemChange: (itemId: string) => void;
    session: RunSessionState;
    isFocused: boolean;
    height: number;
}): React.JSX.Element {
    const t = useT();
    const selectedIndex = Math.max(items.findIndex((item) => item.id === selectedItemId), 0);

    useInput((_input, key) => {
        if (!isFocused || items.length === 0) {
            return;
        }

        if (key.upArrow) {
            const nextIndex = selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1;
            onSelectedItemChange(items[nextIndex]!.id);
            return;
        }

        if (key.downArrow) {
            const nextIndex = selectedIndex >= items.length - 1 ? 0 : selectedIndex + 1;
            onSelectedItemChange(items[nextIndex]!.id);
        }
    });

    const contentLines = Math.max(6, height - 4);
    const headerLines = 3;
    const viewportLines = Math.max(2, contentLines - headerLines);
    const linesPerItem = 2;
    const visibleItemCount = Math.max(1, Math.floor(viewportLines / linesPerItem));
    const windowRange = useMemo(
        () => getVisibleWindow(items.length, selectedIndex, visibleItemCount),
        [items.length, selectedIndex, visibleItemCount]
    );
    const visibleItems = items.slice(windowRange.start, windowRange.end);
    const listHeight = visibleItemCount * linesPerItem;
    const statusLine = t('buildLog.statusLine', {
        status: getSessionStatusLabel(session.status, t),
        runId: session.runId || t('common.placeholder.na'),
        stage: session.currentStage || t('common.placeholder.na'),
        candidate: formatTail(session.currentCandidateId, 22),
        iteration: session.currentIteration ?? t('common.placeholder.na'),
        loopStage: session.currentConvergenceStage || t('common.placeholder.na'),
        outcome: session.terminalOutcomeId || t('common.placeholder.na')
    });

    return (
        <Box
            flexDirection="column"
            width="100%"
            height={height}
            borderStyle="round"
            borderColor={isFocused ? 'green' : 'yellow'}
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Text color="yellowBright">{t('buildLog.title')}</Text>
            <Text dimColor wrap="truncate">{statusLine}</Text>
            <Text dimColor wrap="truncate">
                {items.length > 0
                    ? t('buildLog.range', { start: windowRange.start + 1, end: windowRange.end, total: items.length })
                    : t('buildLog.empty')}
            </Text>

            <Box marginTop={1} flexDirection="column" height={listHeight} minWidth={0}>
                {items.length === 0 ? (
                    <Text dimColor wrap="wrap">{t('buildLog.emptyBody')}</Text>
                ) : null}
                {visibleItems.map((item, index) => {
                    const actualIndex = windowRange.start + index;
                    const isSelected = actualIndex === selectedIndex;

                    return (
                        <Box key={item.id} flexDirection="column" minWidth={0}>
                            <Box width="100%" minWidth={0}>
                                <Box flexDirection="row" flexGrow={1} minWidth={0}>
                                    <Box width={2} minWidth={2}>
                                        <Text color={isSelected ? 'greenBright' : 'white'}>
                                            {isSelected ? '>' : ' '}
                                        </Text>
                                    </Box>
                                    <Box flexGrow={1} minWidth={0}>
                                        <Text color={isSelected ? 'greenBright' : 'white'} wrap="truncate">
                                            {item.title}
                                        </Text>
                                    </Box>
                                </Box>
                                <Box marginLeft={1} flexShrink={0} minWidth={0}>
                                    <Text color={getStatusColor(item.status)} wrap="truncate">
                                        {getBuildLogStatusLabel(item.status, t)}
                                    </Text>
                                </Box>
                            </Box>
                            <Box paddingLeft={2} minWidth={0}>
                                <Text dimColor wrap="truncate">{item.subtitle}</Text>
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}
