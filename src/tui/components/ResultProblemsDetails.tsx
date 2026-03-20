import React from 'react';
import { Box, Text } from 'ink';

import { useT } from '../i18n/use-t.js';

import type { ResultProblemItem, ResultProblemsSummary } from '../state/result-problems.js';

function DetailLine({
    label,
    value,
    valueColor,
    wrapMode = 'truncate'
}: {
    label: string;
    value: string;
    valueColor?: 'red' | 'yellow' | 'green' | 'cyan' | 'white';
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

function getProblemKindLabel(item: ResultProblemItem | null, t: ReturnType<typeof useT>): string {
    if (!item) {
        return t('common.placeholder.na');
    }

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

export function ResultProblemsDetails({
    item,
    summary,
    isFocused,
    height
}: {
    item: ResultProblemItem | null;
    summary: ResultProblemsSummary;
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
                    {item?.title || t('details.problems.title')}
                </Text>
                {item?.subtitle ? (
                    <Text dimColor wrap="truncate">{item.subtitle}</Text>
                ) : null}
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <DetailLine label={t('details.problems.kind')} value={getProblemKindLabel(item, t)} />
                    <DetailLine
                        label={t('details.problems.severity')}
                        value={item ? t(`screen.problems.severity.${item.severity}`) : t('common.placeholder.na')}
                        valueColor={item?.severity === 'blocking' ? 'red' : 'yellow'}
                    />
                    <DetailLine label={t('details.problems.source')} value={item?.source || t('common.placeholder.na')} />
                    <DetailLine
                        label={t('details.problems.files')}
                        value={item?.linkedFileNames.length ? item.linkedFileNames.join(', ') : t('common.placeholder.na')}
                        wrapMode="wrap"
                    />
                    <DetailLine
                        label={t('details.problems.modIds')}
                        value={item?.linkedModIds.length ? item.linkedModIds.join(', ') : t('common.placeholder.na')}
                        wrapMode="wrap"
                    />
                </Box>
            </Box>

            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">{t('details.problems.message')}</Text>
                <Text wrap="wrap">{item?.message || t('details.problems.empty')}</Text>
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text color="cyan" wrap="wrap">{t('details.problems.action')}</Text>
                    <Text wrap="wrap">{item?.suggestedAction || t('details.problems.actionEmpty')}</Text>
                </Box>
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text color="cyan" wrap="wrap">{t('details.problems.summary')}</Text>
                    <DetailLine label={t('details.problems.summary.total')} value={String(summary.total)} />
                    <DetailLine label={t('details.problems.summary.blocking')} value={String(summary.blocking)} valueColor={summary.blocking > 0 ? 'red' : 'white'} />
                    <DetailLine label={t('details.problems.summary.warnings')} value={String(summary.warnings)} valueColor={summary.warnings > 0 ? 'yellow' : 'white'} />
                </Box>
            </Box>
        </Box>
    );
}
