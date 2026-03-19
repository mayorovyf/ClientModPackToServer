import React from 'react';
import { Box, Text } from 'ink';
import { StatusMessage } from '@inkjs/ui';

import { useT } from '../i18n/use-t.js';
import { useScrollOffset } from '../hooks/use-scroll-offset.js';

import type { ServerManagerState } from '../hooks/use-server-manager.js';

function getStatusVariant(status: ServerManagerState['launchStatus']): 'info' | 'success' | 'warning' | 'error' {
    switch (status) {
        case 'running':
            return 'success';
        case 'starting':
            return 'info';
        case 'failed':
            return 'error';
        case 'stopped':
        default:
            return 'warning';
    }
}

export function ServerLogsScreen({
    serverState,
    isFocused,
    height
}: {
    serverState: ServerManagerState;
    isFocused: boolean;
    height: number;
}): React.JSX.Element {
    const t = useT();
    const headerLines = 7;
    const visibleLogCount = Math.max(1, height - headerLines);
    const { offset, hasOverflow } = useScrollOffset({
        itemCount: serverState.logs.length,
        viewportSize: visibleLogCount,
        enabled: isFocused
    });
    const visibleLogs = serverState.logs.slice(offset, offset + visibleLogCount);

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
                <Text color="cyanBright">{t('screen.serverLogs.title')}</Text>
                <Box marginTop={1} minWidth={0}>
                    <StatusMessage variant={getStatusVariant(serverState.launchStatus)}>
                        {serverState.launchStatus === 'running'
                            ? t('screen.serverLogs.running')
                            : serverState.launchStatus === 'starting'
                                ? t('screen.serverLogs.starting')
                                : serverState.launchStatus === 'failed'
                                    ? t('screen.serverLogs.failed', { error: serverState.lastError || t('common.value.unknown') })
                                    : t('screen.serverLogs.idle')}
                    </StatusMessage>
                </Box>
                <Text wrap="wrap">{`${t('server.summary.launch.launcher')}: ${serverState.resolvedEntrypointPath || t('common.placeholder.na')}`}</Text>
                {hasOverflow ? (
                    <Text dimColor wrap="truncate">
                        {t('screen.serverLogs.scroll', {
                            start: offset + 1,
                            end: Math.min(offset + visibleLogs.length, serverState.logs.length),
                            total: serverState.logs.length
                        })}
                    </Text>
                ) : null}
            </Box>

            <Box flexDirection="column" minWidth={0}>
                {visibleLogs.length > 0 ? (
                    visibleLogs.map((line, index) => (
                        <Text key={`${offset + index}-${line}`} dimColor wrap="wrap">
                            {line}
                        </Text>
                    ))
                ) : (
                    <Text dimColor wrap="wrap">{t('screen.serverLogs.empty')}</Text>
                )}
            </Box>
        </Box>
    );
}
