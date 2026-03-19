import React from 'react';
import { Box, Text } from 'ink';

import { useT } from '../i18n/use-t.js';
import type { ServerManagerState } from '../hooks/use-server-manager.js';
import { getServerFieldDetails } from '../state/server-fields.js';
import type { ServerFieldKey } from '../state/server-fields.js';

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
    const t = useT();
    const details = getServerFieldDetails(fieldKey, t);
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
                {details.note ? (
                    <Box marginTop={1} minWidth={0}>
                        <Text color="yellow" wrap="wrap">{details.note}</Text>
                    </Box>
                ) : null}
            </Box>

            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">{t('server.summary.launch.title')}</Text>
                <Text wrap="wrap">{`${t('server.summary.install.status')}: ${serverState.installStatus}`}</Text>
                <Text wrap="wrap">{`${t('server.summary.launch.status')}: ${serverState.launchStatus}`}</Text>
                <Text wrap="wrap">{`${t('server.summary.launch.launcher')}: ${serverState.resolvedEntrypointPath || t('common.placeholder.na')}`}</Text>
                <Text wrap="wrap">{`${t('server.summary.setup.lastBuild')}: ${latestBuildDir || t('common.placeholder.na')}`}</Text>
                {serverState.lastError ? <Text color="red" wrap="wrap">{serverState.lastError}</Text> : null}
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text color="cyan" wrap="wrap">{t('server.summary.launch.logs')}</Text>
                    {visibleLogs.length > 0 ? (
                        visibleLogs.map((line) => (
                            <Text key={line} dimColor wrap="truncate">{line}</Text>
                        ))
                    ) : (
                        <Text dimColor wrap="wrap">{t('server.summary.launch.logs.empty')}</Text>
                    )}
                </Box>
            </Box>
        </Box>
    );
}
