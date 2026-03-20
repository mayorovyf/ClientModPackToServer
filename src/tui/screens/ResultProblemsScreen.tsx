import React, { useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

import { useT } from '../i18n/use-t.js';

import type { ResultProblemItem, ResultProblemsSummary } from '../state/result-problems.js';

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

function getSeverityLabel(item: ResultProblemItem, t: ReturnType<typeof useT>): string {
    return item.severity === 'blocking'
        ? t('screen.problems.severity.blocking')
        : t('screen.problems.severity.warning');
}

function getSeverityColor(item: ResultProblemItem): 'redBright' | 'yellow' {
    return item.severity === 'blocking' ? 'redBright' : 'yellow';
}

function getProblemKindLabel(item: ResultProblemItem, t: ReturnType<typeof useT>): string {
    switch (item.kind) {
        case 'validation':
            switch (item.issueKind) {
                case 'missing-dependency':
                    return t('screen.problems.issueKind.missing-dependency');
                case 'side-mismatch':
                    return t('screen.problems.issueKind.side-mismatch');
                case 'class-loading':
                    return t('screen.problems.issueKind.class-loading');
                case 'java-runtime':
                    return t('screen.problems.issueKind.java-runtime');
                case 'launch-profile':
                    return t('screen.problems.issueKind.launch-profile');
                case 'mixin-failure':
                    return t('screen.problems.issueKind.mixin-failure');
                case 'entrypoint-crash':
                    return t('screen.problems.issueKind.entrypoint-crash');
                case 'unknown-critical':
                    return t('screen.problems.issueKind.unknown-critical');
                case 'validation-no-success-marker':
                    return t('screen.problems.issueKind.validation-no-success-marker');
                default:
                    return t('screen.problems.kind.validation');
            }
        case 'false-removal':
            return t('screen.problems.kind.falseRemoval');
        case 'disputed-mod':
        default:
            return t('screen.problems.kind.disputed');
    }
}

export function ResultProblemsScreen({
    items,
    summary,
    selectedItemId,
    onSelectedItemChange,
    isFocused,
    height
}: {
    items: ResultProblemItem[];
    summary: ResultProblemsSummary;
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
            borderColor={isFocused ? 'green' : 'yellow'}
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Box flexDirection="column" minWidth={0}>
                <Text color="yellowBright">{t('screen.problems.title')}</Text>
                <Text dimColor wrap="truncate">
                    {items.length > 0
                        ? t('screen.problems.range', { start: windowRange.start + 1, end: windowRange.end, total: items.length })
                        : t('screen.problems.empty')}
                </Text>
                <Text dimColor wrap="truncate">
                    {t('screen.problems.state', {
                        blocking: summary.blocking,
                        warnings: summary.warnings,
                        disputed: summary.disputedMods
                    })}
                </Text>
            </Box>

            <Box marginTop={1} flexDirection="column" height={listHeight} minWidth={0}>
                {items.length === 0 ? (
                    <Text dimColor wrap="wrap">{t('screen.problems.emptyBody')}</Text>
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
                                    <Text color={getSeverityColor(item)} wrap="truncate">
                                        {getSeverityLabel(item, t)}
                                    </Text>
                                </Box>
                            </Box>
                            <Box paddingLeft={2} minWidth={0}>
                                <Text dimColor wrap="truncate">
                                    {`${getProblemKindLabel(item, t)} | ${item.subtitle || item.message}`}
                                </Text>
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}
