import React from 'react';
import { Box, Text } from 'ink';

import { useLocale } from '../i18n/use-locale.js';
import { useT } from '../i18n/use-t.js';
import { translateDecisionReason, translateManualOverrideSummary } from '../lib/translate-reason.js';
import type { ReviewItem } from '../state/review-items.js';

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

function getStateLabel(item: ReviewItem | null, t: ReturnType<typeof useT>): string {
    if (!item) {
        return t('common.placeholder.na');
    }

    switch (item.state) {
        case 'keep':
            return t('details.review.state.manualKeep');
        case 'exclude':
            return t('details.review.state.manualExclude');
        case 'history':
            return t('details.review.state.history');
        case 'review':
        default:
            return t('details.review.state.review');
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
    const t = useT();
    const locale = useLocale();
    const displayName = item?.decision.displayName || item?.subject.displayName || null;
    const version = item?.decision.descriptor?.version || item?.subject.version || null;
    const loader = item?.decision.descriptor?.loader || item?.subject.loader || null;
    const modIds = item?.decision.modIds || item?.decision.descriptor?.modIds || item?.subject.modIds || [];
    const lastRunState = item?.lastRunOverrideAction
        ? t('details.review.lastRun.manual', {
            action: translateManualOverrideSummary(item.lastRunOverrideAction, locale)
        })
        : item?.decision.finalSemanticDecision === 'review'
            ? t('details.review.lastRun.review')
            : item?.decision.finalSemanticDecision || t('common.placeholder.na');

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
                <Text color="greenBright" wrap="wrap">{item ? item.decision.fileName : t('details.review.title')}</Text>
                {displayName || version ? (
                    <Text dimColor wrap="wrap">
                        {[displayName, version].filter(Boolean).join(' | ')}
                    </Text>
                ) : null}
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    {item ? (
                        <>
                            <DetailLine label={t('details.review.status')} value={getStateLabel(item, t)} valueColor={getStateColor(item)} />
                            <DetailLine label={t('details.review.lastRun')} value={lastRunState} />
                            <DetailLine label={t('details.review.origin')} value={item.decision.finalDecisionOrigin || item.decision.decisionOrigin || t('common.placeholder.na')} />
                            <DetailLine label={t('details.review.confidence')} value={item.decision.finalConfidence || t('common.placeholder.na')} />
                            <DetailLine label={t('details.review.loader')} value={loader || t('common.placeholder.na')} />
                            <DetailLine label={t('details.review.modIds')} value={modIds.length > 0 ? modIds.join(', ') : t('common.placeholder.na')} />
                        </>
                    ) : (
                        <Text dimColor wrap="wrap">
                            {t('details.review.empty')}
                        </Text>
                    )}
                </Box>

                {item ? (
                    <Box marginTop={1} flexDirection="column" minWidth={0}>
                        <Text color="cyan" wrap="wrap">{t('details.review.reason')}</Text>
                        <Text wrap="wrap">{translateDecisionReason(item.decision.reason, locale)}</Text>
                    </Box>
                ) : null}
            </Box>

            <Box flexDirection="column" minWidth={0}>
                {notice ? (
                    <Box marginBottom={1} minWidth={0}>
                        <Text color={notice.level === 'error' ? 'red' : 'green'} wrap="wrap">{notice.message}</Text>
                    </Box>
                ) : null}
                <Text color="cyan" wrap="wrap">{t('details.review.manual')}</Text>
                <DetailLine
                    label={t('details.review.saved')}
                    value={translateManualOverrideSummary(item?.currentOverrideAction || null, locale)}
                    valueColor={item?.currentOverrideAction === 'keep' ? 'green' : item?.currentOverrideAction === 'exclude' ? 'red' : 'white'}
                />
                <DetailLine
                    label={t('details.review.savedReason')}
                    value={translateDecisionReason(item?.overrideMatch?.entry.reason || null, locale)}
                />
                <DetailLine
                    label={t('details.review.updated')}
                    value={formatDateTime(item?.overrideMatch?.entry.updatedAt || null, t('common.placeholder.na'))}
                />
                <DetailLine label={t('details.review.file')} value={overridesPath} />
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text dimColor wrap="wrap">{t('details.review.action.keep')}</Text>
                    <Text dimColor wrap="wrap">{t('details.review.action.exclude')}</Text>
                    <Text dimColor wrap="wrap">{t('details.review.action.clear')}</Text>
                </Box>
            </Box>
        </Box>
    );
}
