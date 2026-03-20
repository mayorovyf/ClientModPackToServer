import React from 'react';
import { Box, Text } from 'ink';

import { useT } from '../i18n/use-t.js';
import { getBuildLogStatusLabel } from '../state/build-log.js';

import type { BuildLogItem } from '../state/build-log.js';

function getStatusColor(status: BuildLogItem['status']): 'gray' | 'yellow' | 'green' | 'red' | 'cyan' {
    switch (status) {
        case 'running':
            return 'cyan';
        case 'completed':
            return 'green';
        case 'failed':
            return 'red';
        case 'warning':
            return 'yellow';
        case 'pending':
        default:
            return 'gray';
    }
}

function DetailLine({
    label,
    value,
    valueColor,
    wrapMode = 'truncate'
}: {
    label: string;
    value: string;
    valueColor?: 'red' | 'yellow' | 'green' | 'cyan' | 'gray';
    wrapMode?: 'truncate' | 'wrap';
}): React.JSX.Element {
    return (
        <Box flexDirection="row" minWidth={0}>
            <Box width={11} minWidth={11}>
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

export function BuildLogDetails({
    item,
    isFocused,
    height
}: {
    item: BuildLogItem | null;
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
                    {item?.title || t('buildLog.details.title')}
                </Text>
                {item?.subtitle ? (
                    <Text dimColor wrap="truncate">{item.subtitle}</Text>
                ) : null}
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <DetailLine
                        label={t('buildLog.details.status')}
                        value={item ? getBuildLogStatusLabel(item.status, t) : t('common.placeholder.na')}
                        {...(item ? { valueColor: getStatusColor(item.status) } : {})}
                    />
                    <DetailLine label={t('buildLog.details.time')} value={item?.timestamp || t('common.placeholder.na')} />
                    <DetailLine label={t('buildLog.details.source')} value={item?.sourceLabel || t('common.placeholder.na')} />
                </Box>
            </Box>

            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">{t('buildLog.details.description')}</Text>
                <Text wrap="wrap">{item?.description || t('buildLog.details.empty')}</Text>
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text color="cyan" wrap="wrap">{t('buildLog.details.data')}</Text>
                    {item?.dataLines.length ? (
                        item.dataLines.slice(0, 10).map((line) => (
                            <Text key={line} wrap="wrap">{line}</Text>
                        ))
                    ) : (
                        <Text dimColor wrap="wrap">{t('buildLog.details.dataEmpty')}</Text>
                    )}
                </Box>
            </Box>
        </Box>
    );
}
