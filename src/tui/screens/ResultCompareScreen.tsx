import React, { useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

import { useT } from '../i18n/use-t.js';

import type { ResultCompareItem, ResultCompareSummary } from '../state/result-compare.js';

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

function getChangeLabel(item: ResultCompareItem, t: ReturnType<typeof useT>): string {
    switch (item.changeKind) {
        case 'added':
            return t('screen.compare.change.added');
        case 'removed':
            return t('screen.compare.change.removed');
        case 'decision':
            return t('screen.compare.change.decision');
        case 'manual':
            return t('screen.compare.change.manual');
        case 'disputed':
            return t('screen.compare.change.disputed');
        case 'origin':
            return t('screen.compare.change.origin');
        case 'confidence':
        default:
            return t('screen.compare.change.confidence');
    }
}

function getChangeColor(item: ResultCompareItem): 'greenBright' | 'redBright' | 'yellow' | 'cyanBright' {
    switch (item.changeKind) {
        case 'added':
            return 'greenBright';
        case 'removed':
            return 'redBright';
        case 'decision':
        case 'manual':
            return 'yellow';
        case 'disputed':
        case 'origin':
        case 'confidence':
        default:
            return 'cyanBright';
    }
}

function createCompareSubtitle(item: ResultCompareItem): string {
    const leftDecision = item.baselineDecision || 'n/a';
    const rightDecision = item.currentDecision || 'n/a';

    return `${leftDecision} -> ${rightDecision}`;
}

export function ResultCompareScreen({
    items,
    summary,
    selectedItemId,
    onSelectedItemChange,
    isFocused,
    height
}: {
    items: ResultCompareItem[];
    summary: ResultCompareSummary | null;
    selectedItemId: string;
    onSelectedItemChange: (itemId: string) => void;
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
    const headerLines = 4;
    const viewportLines = Math.max(2, contentLines - headerLines);
    const linesPerEntry = 2;
    const visibleEntryCount = Math.max(1, Math.floor(viewportLines / linesPerEntry));
    const windowRange = useMemo(
        () => getVisibleWindow(items.length, selectedIndex, visibleEntryCount),
        [items.length, selectedIndex, visibleEntryCount]
    );
    const visibleItems = items.slice(windowRange.start, windowRange.end);
    const listHeight = visibleEntryCount * linesPerEntry;

    return (
        <Box
            flexDirection="column"
            justifyContent="space-between"
            width="100%"
            height={height}
            borderStyle="round"
            borderColor={isFocused ? 'green' : 'cyan'}
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Box flexDirection="column" minWidth={0}>
                <Text color="cyanBright">{t('screen.compare.title')}</Text>
                <Text dimColor wrap="truncate">
                    {summary
                        ? t('screen.compare.runs', {
                            current: summary.currentRunId || t('common.placeholder.na'),
                            baseline: summary.baselineRunId || t('common.placeholder.na')
                        })
                        : t('screen.compare.noBaseline')}
                </Text>
                <Text dimColor wrap="truncate">
                    {summary
                        ? t('screen.compare.summary', {
                            changed: summary.changedMods,
                            added: summary.addedMods,
                            removed: summary.removedMods,
                            decision: summary.decisionChanges
                        })
                        : t('screen.compare.empty')}
                </Text>
            </Box>

            <Box marginTop={1} flexDirection="column" height={listHeight} minWidth={0}>
                {!summary ? (
                    <Text dimColor wrap="wrap">{t('screen.compare.emptyBody')}</Text>
                ) : null}
                {summary && items.length === 0 ? (
                    <Text dimColor wrap="wrap">{t('screen.compare.noChanges')}</Text>
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
                                            {item.primaryLabel}
                                        </Text>
                                    </Box>
                                </Box>
                                <Box marginLeft={1} flexShrink={0} minWidth={0}>
                                    <Text color={getChangeColor(item)} wrap="truncate">
                                        {getChangeLabel(item, t)}
                                    </Text>
                                </Box>
                            </Box>
                            <Box paddingLeft={2} minWidth={0}>
                                <Text dimColor wrap="truncate">{createCompareSubtitle(item)}</Text>
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}
