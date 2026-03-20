import React from 'react';
import { Box, Text } from 'ink';

import { useT } from '../i18n/use-t.js';

import type { RunSessionStatus } from '../state/app-state.js';

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

function getRunColor(status: RunSessionStatus): 'green' | 'red' | 'white' {
    switch (status) {
        case 'running':
            return 'green';
        case 'failed':
            return 'red';
        default:
            return 'white';
    }
}

function getRunLabel(status: RunSessionStatus, t: ReturnType<typeof useT>): string {
    switch (status) {
        case 'running':
            return t('statusbar.run.running');
        case 'failed':
            return t('statusbar.run.failed');
        case 'succeeded':
            return t('statusbar.run.succeeded');
        case 'idle':
        default:
            return t('statusbar.run.idle');
    }
}

function getOutcomeColor(outcomeId: string | null): 'green' | 'yellow' | 'red' | 'white' {
    switch (outcomeId) {
        case 'success':
            return 'green';
        case 'diagnosable-but-not-fixable':
        case 'not-automatable-within-boundaries':
            return 'yellow';
        case 'failed':
            return 'red';
        default:
            return 'white';
    }
}

function formatCandidateValue({
    currentCandidateId,
    currentIteration,
    candidateCount
}: {
    currentCandidateId: string | null;
    currentIteration: number | null;
    candidateCount: number;
}): string {
    if (typeof currentIteration === 'number' && candidateCount > 0) {
        return `${currentIteration + 1}/${candidateCount}`;
    }

    if (typeof currentIteration === 'number') {
        return String(currentIteration + 1);
    }

    if (currentCandidateId && currentCandidateId.trim()) {
        const trimmed = currentCandidateId.trim();
        return trimmed.length <= 24 ? trimmed : `...${trimmed.slice(-21)}`;
    }

    return '-';
}

export function HeaderChrome({
    width,
    brandWidth,
    gap,
    title,
    modeLabel,
    sectionTabs,
    activeSectionIndex,
    pageTabs,
    activePageIndex,
    runStatus,
    currentStage,
    currentConvergenceStage,
    currentCandidateId,
    currentIteration,
    candidateCount,
    terminalOutcomeId,
    statusMessage,
    noticeTone = null
}: {
    width: number;
    brandWidth: number;
    gap: number;
    title: string;
    modeLabel: string;
    sectionTabs: string[];
    activeSectionIndex: number;
    pageTabs: string[];
    activePageIndex: number;
    runStatus: RunSessionStatus;
    currentStage: string | null;
    currentConvergenceStage: string | null;
    currentCandidateId: string | null;
    currentIteration: number | null;
    candidateCount: number;
    terminalOutcomeId: string | null;
    statusMessage: string;
    noticeTone?: 'success' | 'error' | null;
}): React.JSX.Element {
    const t = useT();
    const chromeColor = 'gray';
    const rightWidth = Math.max(1, width - brandWidth - gap);
    const innerRightWidth = Math.max(1, rightWidth - 2);
    const stageValue = currentStage || currentConvergenceStage || t('common.placeholder.na');
    const candidateValue = formatCandidateValue({
        currentCandidateId,
        currentIteration,
        candidateCount
    });
    const outcomeValue = terminalOutcomeId || '-';
    const topSegments = buildBorderSegments(sectionTabs, activeSectionIndex, innerRightWidth, chromeColor);
    const bottomSegments = buildBorderSegments(pageTabs, activePageIndex, innerRightWidth, chromeColor);
    const noticeColor = noticeTone === 'error' ? 'red' : noticeTone === 'success' ? 'green' : 'white';

    return (
        <Box flexDirection="row" width={width} height={4} minWidth={0}>
            <Box width={brandWidth} height={4} flexShrink={0}>
                <Box
                    flexDirection="column"
                    justifyContent="center"
                    width="100%"
                    height="100%"
                    borderStyle="round"
                    borderColor={chromeColor}
                    paddingX={1}
                    minWidth={0}
                >
                    <Text color="cyanBright" wrap="truncate">{title}</Text>
                    <Text dimColor wrap="truncate">{modeLabel}</Text>
                </Box>
            </Box>

            <Box width={gap} flexShrink={0} />

            <Box width={rightWidth} height={4} minWidth={0} position="relative">
                <Box
                    flexDirection="column"
                    justifyContent="center"
                    width="100%"
                    height="100%"
                    borderStyle="round"
                    borderColor={chromeColor}
                    paddingX={1}
                    minWidth={0}
                >
                    <Text wrap="truncate">
                        {`${t('statusbar.run')}: `}
                        <Text color={getRunColor(runStatus)}>{getRunLabel(runStatus, t)}</Text>
                        <Text dimColor>{' | '}</Text>
                        {`${t('statusbar.stage')}: ${stageValue}`}
                        <Text dimColor>{' | '}</Text>
                        {`${t('runSummary.candidate')}: ${candidateValue}`}
                        <Text dimColor>{' | '}</Text>
                        {`${t('runSummary.outcome')}: `}
                        <Text color={getOutcomeColor(terminalOutcomeId)}>{outcomeValue}</Text>
                    </Text>
                    <Text color={noticeColor} wrap="truncate">{statusMessage}</Text>
                </Box>

                <Box position="absolute" width={rightWidth} height={1} minWidth={0}>
                    {renderBorderLine(topSegments, rightWidth)}
                </Box>
                <Box position="absolute" width={rightWidth} height={1} minWidth={0} marginTop={3}>
                    {renderBorderLine(bottomSegments, rightWidth)}
                </Box>
            </Box>
        </Box>
    );
}
