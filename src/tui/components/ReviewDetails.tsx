import React from 'react';
import { Box, Text } from 'ink';

import { translateDecisionReason, translateManualOverrideSummary } from '../lib/translate-reason.js';
import type { ReviewItem } from '../state/review-items.js';

function formatDateTime(value: string | null): string {
    if (!value) {
        return 'нет';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function getStateLabel(item: ReviewItem | null): string {
    if (!item) {
        return 'n/a';
    }

    switch (item.state) {
        case 'keep':
            return 'manual keep';
        case 'exclude':
            return 'manual exclude';
        case 'history':
            return 'история решения';
        case 'review':
        default:
            return 'нужна проверка';
    }
}

function getStateColor(item: ReviewItem | null): 'green' | 'red' | 'yellow' | 'cyan' | 'white' {
    if (!item) {
        return 'white';
    }

    switch (item.state) {
        case 'keep':
            return 'green';
        case 'exclude':
            return 'red';
        case 'history':
            return 'cyan';
        case 'review':
        default:
            return 'yellow';
    }
}

function DetailLine({
    label,
    value,
    valueColor
}: {
    label: string;
    value: string;
    valueColor?: 'green' | 'red' | 'yellow' | 'cyan' | 'white';
}): React.JSX.Element {
    return (
        <Box flexDirection="row" minWidth={0}>
            <Box width={12} minWidth={12}>
                <Text dimColor wrap="truncate">{label}</Text>
            </Box>
            <Box flexGrow={1} minWidth={0}>
                {valueColor ? (
                    <Text color={valueColor} wrap="wrap">{value}</Text>
                ) : (
                    <Text wrap="wrap">{value}</Text>
                )}
            </Box>
        </Box>
    );
}

export function ReviewDetails({
    item,
    overridesPath,
    notice,
    height,
    isFocused
}: {
    item: ReviewItem | null;
    overridesPath: string;
    notice: {
        level: 'success' | 'error';
        message: string;
    } | null;
    height: number;
    isFocused: boolean;
}): React.JSX.Element {
    const displayName = item?.decision.displayName || item?.subject.displayName || null;
    const version = item?.decision.descriptor?.version || item?.subject.version || null;
    const loader = item?.decision.descriptor?.loader || item?.subject.loader || null;
    const modIds = item?.decision.modIds || item?.decision.descriptor?.modIds || item?.subject.modIds || [];
    const lastRunState = item?.lastRunOverrideAction
        ? `manual ${item.lastRunOverrideAction}`
        : item?.decision.finalSemanticDecision === 'review'
            ? 'review'
            : item?.decision.finalSemanticDecision || 'n/a';

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
                <Text color="greenBright" wrap="wrap">{item ? item.decision.fileName : 'Спорные моды'}</Text>
                {displayName || version ? (
                    <Text dimColor wrap="wrap">
                        {[displayName, version].filter(Boolean).join(' | ')}
                    </Text>
                ) : null}
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    {item ? (
                        <>
                            <DetailLine label="Статус" value={getStateLabel(item)} valueColor={getStateColor(item)} />
                            <DetailLine label="Последний run" value={lastRunState} />
                            <DetailLine label="Origin" value={item.decision.finalDecisionOrigin || item.decision.decisionOrigin || 'n/a'} />
                            <DetailLine label="Confidence" value={item.decision.finalConfidence || 'n/a'} />
                            <DetailLine label="Loader" value={loader || 'n/a'} />
                            <DetailLine label="Mod IDs" value={modIds.length > 0 ? modIds.join(', ') : 'n/a'} />
                        </>
                    ) : (
                        <Text dimColor wrap="wrap">
                            После запуска здесь появится карточка выбранного спорного мода и сохранённого ручного решения.
                        </Text>
                    )}
                </Box>

                {item ? (
                    <Box marginTop={1} flexDirection="column" minWidth={0}>
                        <Text color="cyan" wrap="wrap">Причина</Text>
                        <Text wrap="wrap">{translateDecisionReason(item.decision.reason)}</Text>
                    </Box>
                ) : null}
            </Box>

            <Box flexDirection="column" minWidth={0}>
                {notice ? (
                    <Box marginBottom={1} minWidth={0}>
                        <Text color={notice.level === 'error' ? 'red' : 'green'} wrap="wrap">{notice.message}</Text>
                    </Box>
                ) : null}
                <Text color="cyan" wrap="wrap">Ручное решение</Text>
                <DetailLine
                    label="Сохранено"
                    value={translateManualOverrideSummary(item?.currentOverrideAction || null)}
                    valueColor={item?.currentOverrideAction === 'keep' ? 'green' : item?.currentOverrideAction === 'exclude' ? 'red' : 'white'}
                />
                <DetailLine
                    label="Причина"
                    value={translateDecisionReason(item?.overrideMatch?.entry.reason || 'без пояснения')}
                />
                <DetailLine
                    label="Обновлено"
                    value={formatDateTime(item?.overrideMatch?.entry.updatedAt || null)}
                />
                <DetailLine label="Файл" value={overridesPath} />
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text dimColor wrap="wrap">K сохраняет keep</Text>
                    <Text dimColor wrap="wrap">X сохраняет exclude</Text>
                    <Text dimColor wrap="wrap">C удаляет override</Text>
                </Box>
            </Box>
        </Box>
    );
}
