import React, { useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

import { useT } from '../i18n/use-t.js';
import { normalizeHotkeyInput } from '../lib/normalize-hotkey-input.js';
import { getBuildLogStatusLabel } from '../state/build-log.js';

import type { BuildLogMode, RunSessionState } from '../state/app-state.js';
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

function getSessionStageLabel(session: RunSessionState, t: ReturnType<typeof useT>): string {
    const stageId = String(session.currentStage || '').trim();
    const loopStage = String(session.currentConvergenceStage || '').trim();
    let stageLabel = t('common.placeholder.na');

    switch (stageId) {
        case 'preflight':
            stageLabel = t('buildLog.plan.preflight');
            break;
        case 'classification':
            stageLabel = t('buildLog.plan.classification');
            break;
        case 'dependency':
            stageLabel = t('buildLog.plan.dependency');
            break;
        case 'arbiter':
            stageLabel = t('buildLog.plan.arbiter');
            break;
        case 'deep-check':
            stageLabel = t('buildLog.plan.deepCheck');
            break;
        case 'probe':
            stageLabel = t('buildLog.plan.probe');
            break;
        case 'build':
            stageLabel = t('buildLog.plan.build');
            break;
        case 'server-core':
            stageLabel = t('buildLog.plan.serverCore');
            break;
        case 'validation':
            stageLabel = t('buildLog.plan.validation');
            break;
        case 'report':
            stageLabel = t('buildLog.plan.report');
            break;
        default:
            stageLabel = stageId || t('common.placeholder.na');
            break;
    }

    return loopStage ? `${stageLabel}/${loopStage}` : stageLabel;
}

function getCurrentActivityLabel(items: BuildLogItem[], t: ReturnType<typeof useT>): string {
    for (let index = items.length - 1; index >= 0; index -= 1) {
        const item = items[index];

        if (!item || item.status !== 'running') {
            continue;
        }

        return item.subtitle
            ? `${item.title}: ${item.subtitle}`
            : item.title;
    }

    return t('buildLog.activityNone');
}

export function BuildLogScreen({
    items,
    mode,
    onModeChange,
    selectedItemId,
    onSelectedItemChange,
    session,
    isFocused,
    height
}: {
    items: BuildLogItem[];
    mode: BuildLogMode;
    onModeChange: (nextMode: BuildLogMode) => void;
    selectedItemId: string;
    onSelectedItemChange: (itemId: string) => void;
    session: RunSessionState;
    isFocused: boolean;
    height: number;
}): React.JSX.Element {
    const t = useT();
    const selectedIndex = Math.max(items.findIndex((item) => item.id === selectedItemId), 0);
    const modeLabel = t(mode === 'compact' ? 'buildLog.mode.compact' : 'buildLog.mode.full');
    const currentActivityLabel = getCurrentActivityLabel(items, t);
    const stageLabel = getSessionStageLabel(session, t);

    useInput((input, key) => {
        if (!isFocused) {
            return;
        }

        const normalizedInput = normalizeHotkeyInput(input);

        if (normalizedInput === 'l') {
            onModeChange(mode === 'compact' ? 'full' : 'compact');
            return;
        }

        if (items.length === 0) {
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
    const headerLines = 5;
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
        runId: formatTail(session.runId, 18),
        stage: stageLabel,
        candidate: formatTail(session.currentCandidateId, 18),
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
            <Text dimColor wrap="truncate">{t('buildLog.modeLine', { mode: modeLabel })}</Text>
            <Text dimColor wrap="truncate">{t('buildLog.activityLine', { activity: currentActivityLabel })}</Text>
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
