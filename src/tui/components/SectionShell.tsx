import React from 'react';
import { Box, Text } from 'ink';

import type { ScreenId, SectionPageMap } from '../state/app-state.js';
import type { SectionDefinition } from '../sections/types.js';

const SECTION_TAB_COLOR: Record<ScreenId, string> = {
    build: 'yellow',
    server: 'cyan',
    results: 'magenta',
    settings: 'gray'
};

interface TabSegment {
    text: string;
    active?: boolean;
}

function fitTabLabels(labels: string[], maxChars: number): string[] {
    if (labels.length === 0) {
        return [];
    }

    const charArrays = labels.map((label) => Array.from(label));
    const lengths = charArrays.map((chars) => chars.length);
    const minimumChars = labels.length;

    if (maxChars <= minimumChars) {
        return charArrays.map((chars) => chars[0] ?? '');
    }

    let totalChars = lengths.reduce((sum, length) => sum + length, 0);

    while (totalChars > maxChars) {
        let changed = false;
        const currentMax = Math.max(...lengths);

        for (let index = 0; index < lengths.length && totalChars > maxChars; index += 1) {
            const currentLength = lengths[index] ?? 0;

            if (currentLength === currentMax && currentLength > 1) {
                lengths[index] = currentLength - 1;
                totalChars -= 1;
                changed = true;
            }
        }

        if (!changed) {
            break;
        }
    }

    return charArrays.map((chars, index) => chars.slice(0, lengths[index]).join(''));
}

function buildTabSegments(labels: string[], activeIndex: number, innerWidth: number): TabSegment[] {
    if (innerWidth <= 0) {
        return [];
    }

    const delimiterWidth = labels.length * 2;
    const minimumTailWidth = innerWidth > 2 + delimiterWidth ? 1 : 0;
    const labelBudget = Math.max(labels.length, innerWidth - 2 - delimiterWidth - minimumTailWidth);
    const fittedLabels = fitTabLabels(labels, labelBudget);
    const segments: TabSegment[] = [{ text: '──' }];

    for (const [index, label] of fittedLabels.entries()) {
        segments.push({ text: '┤' });
        segments.push({ text: label, active: index === activeIndex });
        segments.push({ text: '├' });
    }

    const usedWidth = segments.reduce((sum, segment) => sum + Array.from(segment.text).length, 0);
    const tailWidth = Math.max(0, innerWidth - usedWidth);

    if (tailWidth > 0) {
        segments.push({ text: '─'.repeat(tailWidth) });
    }

    return segments;
}

function renderTabsOnBorder<S extends ScreenId>({
    section,
    activePageId,
    isFocused,
    width
}: {
    section: SectionDefinition<S>;
    activePageId: SectionPageMap[S];
    isFocused: boolean;
    width: number;
}): React.JSX.Element {
    const activePage = section.pages.find((page) => page.id === activePageId) ?? section.pages[0];
    const borderColor = isFocused ? 'green' : (activePage?.chromeColor ?? SECTION_TAB_COLOR[section.id] ?? 'cyan');
    const innerWidth = Math.max(1, width - 2);
    const activeIndex = Math.max(0, section.pages.findIndex((page) => page.id === activePageId));
    const segments = buildTabSegments(section.pages.map((page) => page.label), activeIndex, innerWidth);

    return (
        <Box flexDirection="row" width={width} minWidth={0}>
            <Box width={1} minWidth={1} />
            <Box width={innerWidth} minWidth={0} overflow="hidden">
                <Text>
                    {segments.map((segment, index) => (
                        <Text
                            key={`${index}-${segment.text}`}
                            color={segment.active ? 'whiteBright' : borderColor}
                        >
                            {segment.text}
                        </Text>
                    ))}
                </Text>
            </Box>
            <Box width={1} minWidth={1} />
        </Box>
    );
}

export function SectionShell<S extends ScreenId>({
    section,
    activePageId,
    height,
    width,
    isFocused,
    content
}: {
    section: SectionDefinition<S>;
    activePageId: SectionPageMap[S];
    height: number;
    width: number;
    isFocused: boolean;
    content: (contentHeight: number) => React.JSX.Element;
}): React.JSX.Element {
    const showTabs = section.pages.length > 1;
    const contentHeight = Math.max(1, height);

    return (
        <Box flexDirection="column" width={width} height={height} minWidth={0} position="relative">
            <Box flexGrow={1} height={contentHeight} minWidth={0}>
                {content(contentHeight)}
            </Box>
            {showTabs ? (
                <Box position="absolute" width={width} height={1} minWidth={0}>
                    {renderTabsOnBorder({ section, activePageId, isFocused, width })}
                </Box>
            ) : null}
        </Box>
    );
}
