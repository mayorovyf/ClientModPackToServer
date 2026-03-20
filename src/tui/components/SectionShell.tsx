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

const BORDER_HORIZONTAL = '\u2500';
const BORDER_RIGHT_TEE = '\u2524';
const BORDER_LEFT_TEE = '\u251C';

interface BorderSegment {
    text: string;
    color: string;
}

function fitBorderLabels(labels: string[], maxChars: number): string[] {
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

function buildBorderSegments(labels: string[], activeIndex: number, innerWidth: number, borderColor: string): BorderSegment[] {
    if (innerWidth <= 0) {
        return [];
    }

    if (labels.length === 0) {
        return [{
            text: BORDER_HORIZONTAL.repeat(innerWidth),
            color: borderColor
        }];
    }

    const prefixWidth = Math.min(2, innerWidth);
    const delimiterWidth = labels.length * 2;
    const minimumTailWidth = innerWidth > prefixWidth + delimiterWidth ? 1 : 0;
    const labelBudget = Math.max(labels.length, innerWidth - prefixWidth - delimiterWidth - minimumTailWidth);
    const fittedLabels = fitBorderLabels(labels, labelBudget);
    const segments: BorderSegment[] = [{
        text: BORDER_HORIZONTAL.repeat(prefixWidth),
        color: borderColor
    }];

    for (const [index, label] of fittedLabels.entries()) {
        segments.push({ text: BORDER_RIGHT_TEE, color: borderColor });
        segments.push({
            text: label,
            color: index === activeIndex ? 'whiteBright' : borderColor
        });
        segments.push({ text: BORDER_LEFT_TEE, color: borderColor });
    }

    const usedWidth = segments.reduce((sum, segment) => sum + Array.from(segment.text).length, 0);
    const tailWidth = Math.max(0, innerWidth - usedWidth);

    if (tailWidth > 0) {
        segments.push({
            text: BORDER_HORIZONTAL.repeat(tailWidth),
            color: borderColor
        });
    }

    return segments;
}

function getBorderColor<S extends ScreenId>(section: SectionDefinition<S>, activePageId: SectionPageMap[S], isFocused: boolean): string {
    const activePage = section.pages.find((page) => page.id === activePageId) ?? section.pages[0];
    return isFocused ? 'green' : (activePage?.chromeColor ?? SECTION_TAB_COLOR[section.id] ?? 'cyan');
}

function renderBorderLine(segments: BorderSegment[], width: number): React.JSX.Element {
    const innerWidth = Math.max(1, width - 2);

    return (
        <Box flexDirection="row" width={width} minWidth={0}>
            <Box width={1} minWidth={1} />
            <Box width={innerWidth} minWidth={0} overflow="hidden">
                <Text>
                    {segments.map((segment, index) => (
                        <Text
                            key={`${index}-${segment.text}`}
                            color={segment.color}
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
    showTabs = true,
    frameLabel = null,
    height,
    width,
    isFocused,
    content
}: {
    section: SectionDefinition<S>;
    activePageId: SectionPageMap[S];
    showTabs?: boolean;
    frameLabel?: string | null;
    height: number;
    width: number;
    isFocused: boolean;
    content: (contentHeight: number) => React.JSX.Element;
}): React.JSX.Element {
    const shouldShowTabs = showTabs && section.pages.length > 1;
    const contentHeight = Math.max(1, height);
    const innerWidth = Math.max(1, width - 2);
    const borderColor = getBorderColor(section, activePageId, isFocused);
    const activeIndex = Math.max(0, section.pages.findIndex((page) => page.id === activePageId));
    const topSegments = shouldShowTabs
        ? buildBorderSegments(section.pages.map((page) => page.label), activeIndex, innerWidth, borderColor)
        : [];
    const bottomSegments = frameLabel
        ? buildBorderSegments([frameLabel], 0, innerWidth, borderColor)
        : [];

    return (
        <Box flexDirection="column" width={width} height={height} minWidth={0} position="relative">
            <Box flexGrow={1} height={contentHeight} minWidth={0}>
                {content(contentHeight)}
            </Box>
            {shouldShowTabs ? (
                <Box position="absolute" width={width} height={1} minWidth={0}>
                    {renderBorderLine(topSegments, width)}
                </Box>
            ) : null}
            {frameLabel ? (
                <Box position="absolute" width={width} height={1} minWidth={0} marginTop={Math.max(0, height - 1)}>
                    {renderBorderLine(bottomSegments, width)}
                </Box>
            ) : null}
        </Box>
    );
}
