import React from 'react';
import { Box, Text } from 'ink';

import { getServerFieldDetails } from '../state/server-fields.js';
import type { ServerFieldKey } from '../state/server-fields.js';

import type { ServerManagerState } from '../hooks/use-server-manager.js';

export function ServerDetails({
    fieldKey,
    serverState,
    latestBuildDir,
    height
}: {
    fieldKey: ServerFieldKey;
    serverState: ServerManagerState;
    latestBuildDir: string | null;
    height: number;
}): React.JSX.Element {
    const details = getServerFieldDetails(fieldKey);
    const visibleLogs = serverState.logs.slice(-8);

    return (
        <Box
            flexDirection="column"
            justifyContent="space-between"
            width="100%"
            height={height}
            borderStyle="round"
            borderColor="cyan"
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Box flexDirection="column" minWidth={0}>
                <Text color="greenBright" wrap="wrap">{details.title}</Text>
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text wrap="wrap">{details.overview}</Text>
                </Box>
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    {details.options.map((option) => (
                        <Box key={option.label} flexDirection="column" minWidth={0}>
                            <Text color="whiteBright" wrap="wrap">{option.label}</Text>
                            <Text dimColor wrap="wrap">{option.description}</Text>
                        </Box>
                    ))}
                </Box>
                {details.note ? (
                    <Box marginTop={1} minWidth={0}>
                        <Text color="yellow" wrap="wrap">{details.note}</Text>
                    </Box>
                ) : null}
            </Box>

            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">Server status</Text>
                <Text wrap="wrap">{`Install: ${serverState.installStatus}`}</Text>
                <Text wrap="wrap">{`Launch: ${serverState.launchStatus}`}</Text>
                <Text wrap="wrap">{`Launcher: ${serverState.resolvedEntrypointPath || 'n/a'}`}</Text>
                <Text wrap="wrap">{`Last build: ${latestBuildDir || 'n/a'}`}</Text>
                {serverState.lastError ? <Text color="red" wrap="wrap">{serverState.lastError}</Text> : null}
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text color="cyan" wrap="wrap">Recent logs</Text>
                    {visibleLogs.length > 0 ? (
                        visibleLogs.map((line) => (
                            <Text key={line} dimColor wrap="truncate">{line}</Text>
                        ))
                    ) : (
                        <Text dimColor wrap="wrap">Логи сервера и installer появятся здесь.</Text>
                    )}
                </Box>
            </Box>
        </Box>
    );
}
