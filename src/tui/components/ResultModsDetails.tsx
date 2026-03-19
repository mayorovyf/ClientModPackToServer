import React from 'react';
import { Box, Text } from 'ink';
import path from 'node:path';

import { useLocale } from '../i18n/use-locale.js';
import { useT } from '../i18n/use-t.js';
import { translateDecisionReason, translateManualOverrideSummary } from '../lib/translate-reason.js';
import { getResultModsSortLabel } from '../state/results-mods.js';

import type { ResultModItem, ResultModsSortMode } from '../state/results-mods.js';
import type { DecisionReviewState } from '../state/review-items.js';

function formatDateTime(value: string | null, fallback: string): string {
    if (!value) {
        return fallback;
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
            <Box width={9} minWidth={9}>
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

function compactPath(value: string): string {
    if (!value) {
        return value;
    }

    const baseName = path.basename(value);
    return baseName.length < value.length ? `...${path.sep}${baseName}` : value;
}

function getDecisionColor(item: ResultModItem | null): 'green' | 'red' | 'yellow' | 'white' {
    switch (item?.finalDecision) {
        case 'keep':
            return 'green';
        case 'remove':
            return 'red';
        case 'review':
            return 'yellow';
        default:
            return 'white';
    }
}

function getReviewStateLabel(reviewState: DecisionReviewState | null, t: ReturnType<typeof useT>): string {
    switch (reviewState?.state) {
        case 'keep':
            return t('details.review.state.manualKeep');
        case 'exclude':
            return t('details.review.state.manualExclude');
        case 'history':
            return t('details.review.state.history');
        case 'review':
            return t('details.review.state.review');
        case 'resolved':
        default:
            return t('common.placeholder.na');
    }
}

function getReviewStateColor(reviewState: DecisionReviewState | null): 'green' | 'red' | 'yellow' | 'cyan' | 'white' {
    switch (reviewState?.state) {
        case 'keep':
            return 'green';
        case 'exclude':
            return 'red';
        case 'history':
            return 'cyan';
        case 'review':
            return 'yellow';
        case 'resolved':
        default:
            return 'white';
    }
}

export function ResultModsDetails({
    item,
    reviewState,
    totalCount,
    disputedCount,
    disputedOnly,
    sortMode,
    reviewOverridesPath,
    reviewNotice,
    isFocused,
    height
}: {
    item: ResultModItem | null;
    reviewState: DecisionReviewState | null;
    totalCount: number;
    disputedCount: number;
    disputedOnly: boolean;
    sortMode: ResultModsSortMode;
    reviewOverridesPath: string;
    reviewNotice: {
        level: 'success' | 'error';
        message: string;
    } | null;
    isFocused: boolean;
    height: number;
}): React.JSX.Element {
    const t = useT();
    const locale = useLocale();
    const modIds = item?.modIds || [];
    const lastRunState = reviewState?.lastRunOverrideAction
        ? t('details.review.lastRun.manual', {
            action: translateManualOverrideSummary(reviewState.lastRunOverrideAction, locale)
        })
        : item?.finalDecision === 'review'
            ? t('details.review.lastRun.review')
            : item?.finalDecision || t('common.placeholder.na');

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
                <Text color="greenBright" wrap="wrap">
                    {item?.primaryLabel || item?.decision.fileName || t('details.mods.title')}
                </Text>
                {item?.version ? (
                    <Text dimColor wrap="wrap">{item.version}</Text>
                ) : null}
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <DetailLine label={t('details.mods.visible')} value={String(totalCount)} />
                    <DetailLine label={t('details.mods.disputed')} value={String(disputedCount)} />
                    <DetailLine label={t('details.mods.filter')} value={disputedOnly ? t('screen.mods.filter.disputed') : t('screen.mods.filter.all')} />
                    <DetailLine label={t('details.mods.sort')} value={getResultModsSortLabel(sortMode, t)} />
                </Box>

                {item ? (
                    <Box marginTop={1} flexDirection="column" minWidth={0}>
                        <DetailLine label={t('details.mods.final')} value={item.finalDecision || t('common.placeholder.na')} valueColor={getDecisionColor(item)} />
                        <DetailLine label={t('details.mods.build')} value={item.buildDecision || t('common.placeholder.na')} />
                        <DetailLine label={t('details.mods.confidence')} value={item.finalConfidence || t('common.placeholder.na')} />
                        <DetailLine label={t('details.mods.loader')} value={item.loader || t('common.placeholder.na')} />
                        <DetailLine label={t('details.mods.origin')} value={item.finalOrigin || t('common.placeholder.na')} />
                        <DetailLine
                            label={t('details.mods.modIds')}
                            value={modIds.length > 0 ? modIds.join(', ') : t('common.placeholder.na')}
                            wrapMode="wrap"
                        />
                        <DetailLine
                            label={t('details.mods.manual')}
                            value={item.currentOverrideAction || item.lastRunOverrideAction || t('common.placeholder.na')}
                        />
                        <DetailLine label={t('details.mods.arbiter')} value={item.arbiterDecision || t('common.placeholder.na')} />
                        <DetailLine label={t('details.mods.deepCheck')} value={item.deepCheckDecision || item.decision.deepCheckStatus || t('common.placeholder.na')} />
                        <DetailLine label={t('details.mods.file')} value={item.decision.fileName} />
                        <Box marginTop={1} flexDirection="column" minWidth={0}>
                            <DetailLine label={t('details.review.status')} value={getReviewStateLabel(reviewState, t)} valueColor={getReviewStateColor(reviewState)} />
                            <DetailLine label={t('details.review.lastRun')} value={lastRunState} />
                            <DetailLine
                                label={t('details.review.saved')}
                                value={translateManualOverrideSummary(reviewState?.currentOverrideAction || null, locale)}
                                valueColor={reviewState?.currentOverrideAction === 'keep' ? 'green' : reviewState?.currentOverrideAction === 'exclude' ? 'red' : 'white'}
                            />
                            <DetailLine
                                label={t('details.review.savedReason')}
                                value={translateDecisionReason(reviewState?.overrideMatch?.entry.reason || null, locale)}
                                wrapMode="truncate"
                            />
                            <DetailLine
                                label={t('details.review.updated')}
                                value={formatDateTime(reviewState?.overrideMatch?.entry.updatedAt || null, t('common.placeholder.na'))}
                            />
                        </Box>
                    </Box>
                ) : (
                    <Box marginTop={1} minWidth={0}>
                        <Text dimColor wrap="wrap">{t('details.mods.empty')}</Text>
                    </Box>
                )}
            </Box>

            <Box flexDirection="column" minWidth={0}>
                {reviewNotice ? (
                    <Box marginBottom={1} minWidth={0}>
                        <Text color={reviewNotice.level === 'error' ? 'red' : 'green'} wrap="wrap">{reviewNotice.message}</Text>
                    </Box>
                ) : null}
                <Text color="cyan" wrap="wrap">{t('details.mods.reason')}</Text>
                <Text wrap="truncate">{translateDecisionReason(item?.decision.reason || null, locale) || t('details.mods.reasonEmpty')}</Text>
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text color="cyan" wrap="wrap">{t('details.review.manual')}</Text>
                    <DetailLine label={t('details.review.file')} value={compactPath(reviewOverridesPath)} />
                </Box>
            </Box>
        </Box>
    );
}
