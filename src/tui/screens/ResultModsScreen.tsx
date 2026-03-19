import React, { useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

import { useT } from '../i18n/use-t.js';
import { normalizeHotkeyInput } from '../lib/normalize-hotkey-input.js';
import { cycleResultModsSortMode, getResultModsSortLabel } from '../state/results-mods.js';

import type { ResultModItem, ResultModsSortMode } from '../state/results-mods.js';

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

function getDecisionLabel(item: ResultModItem, t: ReturnType<typeof useT>): string {
    switch (item.finalDecision) {
        case 'keep':
            return t('screen.mods.decision.keep');
        case 'remove':
            return t('screen.mods.decision.remove');
        case 'review':
            return t('screen.mods.decision.review');
        default:
            return t('screen.mods.decision.unknown');
    }
}

function getDecisionColor(item: ResultModItem): 'greenBright' | 'redBright' | 'yellow' | 'gray' {
    switch (item.finalDecision) {
        case 'keep':
            return 'greenBright';
        case 'remove':
            return 'redBright';
        case 'review':
            return 'yellow';
        default:
            return 'gray';
    }
}

function createSubtitle(item: ResultModItem, t: ReturnType<typeof useT>): string {
    const parts: string[] = [];

    if (item.primaryLabel !== item.decision.fileName) {
        parts.push(item.decision.fileName);
    } else if (item.modIds[0]) {
        parts.push(item.modIds[0]);
    }

    if (item.finalConfidence) {
        parts.push(item.finalConfidence);
    }

    if (item.finalOrigin) {
        parts.push(item.finalOrigin);
    }

    return parts.join(' | ') || t('common.placeholder.na');
}

export function ResultModsScreen({
    items,
    totalCount,
    disputedCount,
    selectedItemId,
    onSelectedItemChange,
    onSaveOverride,
    onConfirmOverride,
    onClearOverride,
    disputedOnly,
    onDisputedOnlyChange,
    sortMode,
    onSortModeChange,
    isFocused,
    height
}: {
    items: ResultModItem[];
    totalCount: number;
    disputedCount: number;
    selectedItemId: string;
    onSelectedItemChange: (itemId: string) => void;
    onSaveOverride: (action: 'keep' | 'exclude') => void;
    onConfirmOverride: () => void;
    onClearOverride: () => void;
    disputedOnly: boolean;
    onDisputedOnlyChange: (nextValue: boolean) => void;
    sortMode: ResultModsSortMode;
    onSortModeChange: (nextValue: ResultModsSortMode) => void;
    isFocused: boolean;
    height: number;
}): React.JSX.Element {
    const t = useT();
    const selectedIndex = Math.max(items.findIndex((item) => item.id === selectedItemId), 0);
    const selectedItem = items[selectedIndex] || null;

    useInput((input, key) => {
        if (!isFocused) {
            return;
        }

        if (key.upArrow && items.length > 0) {
            const nextIndex = selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1;
            onSelectedItemChange(items[nextIndex]!.id);
            return;
        }

        if (key.downArrow && items.length > 0) {
            const nextIndex = selectedIndex >= items.length - 1 ? 0 : selectedIndex + 1;
            onSelectedItemChange(items[nextIndex]!.id);
            return;
        }

        if (key.return && selectedItem?.currentOverrideAction && !selectedItem.currentOverrideConfirmed) {
            onConfirmOverride();
            return;
        }

        const normalizedInput = normalizeHotkeyInput(input);

        if (normalizedInput === 'f') {
            onDisputedOnlyChange(!disputedOnly);
            return;
        }

        if (normalizedInput === 's') {
            onSortModeChange(cycleResultModsSortMode(sortMode));
            return;
        }

        if (normalizedInput === 'k') {
            onSaveOverride('keep');
            return;
        }

        if (normalizedInput === 'x') {
            onSaveOverride('exclude');
            return;
        }

        if (normalizedInput === 'c') {
            onClearOverride();
        }
    });

    const contentLines = Math.max(6, height - 4);
    const headerLines = 4;
    const viewportLines = Math.max(2, contentLines - headerLines);
    const linesPerEntry = 2;
    const visibleEntryCount = Math.max(1, Math.floor(viewportLines / linesPerEntry));
    const listHeight = visibleEntryCount * linesPerEntry;
    const windowRange = useMemo(
        () => getVisibleWindow(items.length, selectedIndex, visibleEntryCount),
        [items.length, selectedIndex, visibleEntryCount]
    );
    const visibleItems = items.slice(windowRange.start, windowRange.end);

    return (
        <Box
            flexDirection="column"
            justifyContent="space-between"
            width="100%"
            height={height}
            borderStyle="round"
            borderColor={isFocused ? 'green' : 'green'}
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Box flexDirection="column" minWidth={0}>
                <Text color="greenBright">{t('screen.mods.title')}</Text>
                <Text dimColor wrap="truncate">
                    {items.length > 0
                        ? t('screen.mods.range', { start: windowRange.start + 1, end: windowRange.end, total: items.length })
                        : t('screen.mods.empty')}
                </Text>
                <Text dimColor wrap="truncate">
                    {t('screen.mods.state', {
                        filter: disputedOnly ? t('screen.mods.filter.disputed') : t('screen.mods.filter.all'),
                        disputed: disputedCount,
                        sort: getResultModsSortLabel(sortMode, t)
                    })}
                </Text>
            </Box>

            <Box marginTop={1} flexDirection="column" height={listHeight} minWidth={0}>
                {items.length === 0 ? (
                    <Text dimColor wrap="wrap">{t('screen.mods.emptyBody')}</Text>
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
                                <Box marginLeft={1} width={8} minWidth={8}>
                                    <Text color={getDecisionColor(item)} wrap="truncate">
                                        {getDecisionLabel(item, t)}
                                    </Text>
                                </Box>
                            </Box>
                            <Box paddingLeft={2} minWidth={0}>
                                <Text dimColor wrap="truncate">{createSubtitle(item, t)}</Text>
                            </Box>
                        </Box>
                    );
                })}
            </Box>

        </Box>
    );
}
