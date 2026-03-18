import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';

import type { ManualReviewAction } from '../../review/manual-overrides.js';
import { translateDecisionReason } from '../lib/translate-reason.js';
import type { ReviewItem } from '../state/review-items.js';

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

function getStateLabel(item: ReviewItem): string {
    switch (item.state) {
        case 'keep':
            return 'KEEP';
        case 'exclude':
            return 'EXCLUDE';
        case 'history':
            return 'HISTORY';
        case 'review':
        default:
            return 'REVIEW';
    }
}

function getStateColor(item: ReviewItem): 'greenBright' | 'redBright' | 'yellow' | 'cyan' {
    switch (item.state) {
        case 'keep':
            return 'greenBright';
        case 'exclude':
            return 'redBright';
        case 'history':
            return 'cyan';
        case 'review':
        default:
            return 'yellow';
    }
}

function createReviewSubtitle(item: ReviewItem): string {
    if (item.currentOverrideAction === 'keep') {
        return 'Сохранено вручную: оставить';
    }

    if (item.currentOverrideAction === 'exclude') {
        return 'Сохранено вручную: исключить';
    }

    if (item.state === 'history') {
        return 'В последнем отчёте было ручное решение';
    }

    return translateDecisionReason(item.decision.reason || 'Требуется ручная проверка');
}

export function ReviewScreen({
    items,
    selectedItemId,
    onSelectedItemChange,
    onSaveOverride,
    onClearOverride,
    isFocused,
    height
}: {
    items: ReviewItem[];
    selectedItemId: string;
    onSelectedItemChange: (itemId: string) => void;
    onSaveOverride: (action: ManualReviewAction) => void;
    onClearOverride: () => void;
    isFocused: boolean;
    height: number;
}): React.JSX.Element {
    const initialSelectedIndex = Math.max(items.findIndex((item) => item.id === selectedItemId), 0);
    const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);

    useEffect(() => {
        setSelectedIndex(Math.max(items.findIndex((item) => item.id === selectedItemId), 0));
    }, [items, selectedItemId]);

    useEffect(() => {
        const activeItem = items[selectedIndex] || null;

        if (activeItem && activeItem.id !== selectedItemId) {
            onSelectedItemChange(activeItem.id);
        }
    }, [items, onSelectedItemChange, selectedIndex, selectedItemId]);

    useInput((input, key) => {
        if (!isFocused || items.length === 0) {
            return;
        }

        if (key.upArrow) {
            setSelectedIndex((current) => (current <= 0 ? items.length - 1 : current - 1));
            return;
        }

        if (key.downArrow) {
            setSelectedIndex((current) => (current >= items.length - 1 ? 0 : current + 1));
            return;
        }

        const normalizedInput = input.toLowerCase();

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
    const windowRange = useMemo(
        () => getVisibleWindow(items.length, selectedIndex, visibleEntryCount),
        [items.length, selectedIndex, visibleEntryCount]
    );
    const visibleItems = items.slice(windowRange.start, windowRange.end);
    const listHeight = visibleEntryCount * linesPerEntry;
    const reviewCount = items.filter((item) => item.state === 'review').length;
    const savedCount = items.filter((item) => Boolean(item.currentOverrideAction)).length;

    return (
        <Box
            flexDirection="column"
            justifyContent="space-between"
            width="100%"
            height={height}
            borderStyle="round"
            borderColor={isFocused ? 'green' : 'red'}
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Box flexDirection="column" minWidth={0}>
                <Text color="redBright">Спорные</Text>
                {items.length > 0 ? (
                    <>
                        <Text dimColor wrap="truncate">{`Моды ${windowRange.start + 1}-${windowRange.end} из ${items.length}`}</Text>
                        <Text dimColor wrap="truncate">{`Нужно решить: ${reviewCount} | Сохранено: ${savedCount}`}</Text>
                    </>
                ) : (
                    <Text dimColor wrap="truncate">Нет спорных модов в последнем отчёте</Text>
                )}
            </Box>

            <Box marginTop={1} flexDirection="column" height={listHeight} minWidth={0}>
                {items.length === 0 ? (
                    <Text dimColor wrap="wrap">
                        После запуска здесь появится список модов со статусом review и модов, для которых уже сохранено ручное решение.
                    </Text>
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
                                            {isSelected ? '▸' : ' '}
                                        </Text>
                                    </Box>
                                    <Box flexGrow={1} minWidth={0}>
                                        <Text color={isSelected ? 'greenBright' : 'white'} wrap="truncate">
                                            {item.decision.fileName}
                                        </Text>
                                    </Box>
                                </Box>
                                <Box marginLeft={1} flexShrink={0} minWidth={0}>
                                    <Text color={getStateColor(item)} wrap="truncate">
                                        {getStateLabel(item)}
                                    </Text>
                                </Box>
                            </Box>
                            <Box paddingLeft={2} minWidth={0}>
                                <Text dimColor wrap="truncate">{createReviewSubtitle(item)}</Text>
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}
