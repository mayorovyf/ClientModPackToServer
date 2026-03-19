import React from 'react';
import { Box, Text } from 'ink';

import { useT } from '../i18n/use-t.js';

import type { ResultCompareItem, ResultCompareSummary } from '../state/result-compare.js';

function DetailLine({
    label,
    value,
    valueColor,
    wrapMode = 'truncate'
}: {
    label: string;
    value: string;
    valueColor?: 'green' | 'red' | 'yellow' | 'cyan' | 'white';
    wrapMode?: 'truncate' | 'wrap';
}): React.JSX.Element {
    return (
        <Box flexDirection="row" minWidth={0}>
            <Box width={10} minWidth={10}>
                <Text dimColor wrap="truncate">{label}</Text>
            </Box>
            <Box flexGrow={1} minWidth={0}>
                {valueColor ? (
                    <Text color={valueColor} wrap={wrapMode}>{value}</Text>
                ) : (
                    <Text wrap={wrapMode}>{value}</Text>
                )}
            </Box>
        </Box>
    );
}

function getChangeColor(item: ResultCompareItem | null): 'green' | 'red' | 'yellow' | 'cyan' | 'white' {
    switch (item?.changeKind) {
        case 'added':
            return 'green';
        case 'removed':
            return 'red';
        case 'decision':
        case 'manual':
            return 'yellow';
        case 'disputed':
        case 'origin':
        case 'confidence':
            return 'cyan';
        default:
            return 'white';
    }
}

function getChangeLabel(item: ResultCompareItem | null, t: ReturnType<typeof useT>): string {
    switch (item?.changeKind) {
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
            return t('screen.compare.change.confidence');
        default:
            return t('common.placeholder.na');
    }
}

export function ResultCompareDetails({
    item,
    summary,
    isFocused,
    height
}: {
    item: ResultCompareItem | null;
    summary: ResultCompareSummary | null;
    isFocused: boolean;
    height: number;
}): React.JSX.Element {
    const t = useT();

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
                <Text color="greenBright" wrap="truncate">
                    {item?.primaryLabel || t('details.compare.title')}
                </Text>
                {item?.fileName ? (
                    <Text dimColor wrap="truncate">{item.fileName}</Text>
                ) : null}
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <DetailLine
                        label={t('details.compare.change')}
                        value={getChangeLabel(item, t)}
                        valueColor={getChangeColor(item)}
                    />
                    <DetailLine label={t('details.compare.current')} value={item?.currentDecision || t('common.placeholder.na')} />
                    <DetailLine label={t('details.compare.baseline')} value={item?.baselineDecision || t('common.placeholder.na')} />
                    <DetailLine label={t('details.compare.origin')} value={`${item?.baselineOrigin || 'n/a'} -> ${item?.currentOrigin || 'n/a'}`} wrapMode="wrap" />
                    <DetailLine label={t('details.compare.confidence')} value={`${item?.baselineConfidence || 'n/a'} -> ${item?.currentConfidence || 'n/a'}`} />
                    <DetailLine label={t('details.compare.manual')} value={`${item?.baselineOverrideAction || 'n/a'} -> ${item?.currentOverrideAction || 'n/a'}`} />
                    <DetailLine label={t('details.compare.disputed')} value={`${item?.baselineIsDisputed ? 'yes' : 'no'} -> ${item?.currentIsDisputed ? 'yes' : 'no'}`} />
                </Box>
            </Box>

            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">{t('details.compare.summary')}</Text>
                {summary ? (
                    <>
                        <DetailLine label={t('details.compare.changed')} value={String(summary.changedMods)} />
                        <DetailLine label={t('details.compare.added')} value={String(summary.addedMods)} valueColor={summary.addedMods > 0 ? 'green' : 'white'} />
                        <DetailLine label={t('details.compare.removed')} value={String(summary.removedMods)} valueColor={summary.removedMods > 0 ? 'red' : 'white'} />
                        <DetailLine label={t('details.compare.keepDelta')} value={String(summary.keepDelta)} />
                        <DetailLine label={t('details.compare.removeDelta')} value={String(summary.removeDelta)} />
                        <DetailLine label={t('details.compare.reviewDelta')} value={String(summary.disputedDelta)} />
                        <DetailLine label={t('details.compare.issueDelta')} value={String(summary.issueDelta)} />
                    </>
                ) : (
                    <Text dimColor wrap="wrap">{t('details.compare.empty')}</Text>
                )}
            </Box>
        </Box>
    );
}
