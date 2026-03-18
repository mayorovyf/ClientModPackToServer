import React from 'react';
import { Box, Text } from 'ink';
import { StatusMessage } from '@inkjs/ui';

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
                <Text color="cyanBright">Server Logs</Text>
                <Box marginTop={1} minWidth={0}>
                    <StatusMessage variant={getStatusVariant(serverState.launchStatus)}>
                        {serverState.launchStatus === 'running'
                            ? 'Server process is running'
                            : serverState.launchStatus === 'starting'
                                ? 'Server process is starting'
                                : serverState.launchStatus === 'failed'
                                    ? `Server process failed: ${serverState.lastError || 'unknown error'}`
                                    : 'Server process is not running'}
                    </StatusMessage>
                </Box>
                <Text wrap="wrap">{`Launcher: ${serverState.resolvedEntrypointPath || 'n/a'}`}</Text>
                {hasOverflow ? (
                    <Text dimColor wrap="truncate">
                        {`↑/↓ scroll logs | ${offset + 1}-${Math.min(offset + visibleLogs.length, serverState.logs.length)} of ${serverState.logs.length}`}
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
                    <Text dimColor wrap="wrap">
                        Server and installer logs will appear here. Use the Launch page for start/stop actions.
                    </Text>
                )}
            </Box>
        </Box>
    );
}
