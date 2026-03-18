import React from 'react';
import { Box, Text } from 'ink';

import type { ScreenId, TuiMode } from '../state/app-state.js';

function StatusCell({
    label,
    value,
    color
}: {
    label: string;
    value: string;
    color?: 'cyan' | 'yellow' | 'green' | 'red' | 'white';
}): React.JSX.Element {
    return (
        <Box flexGrow={1} minWidth={0}>
            <Text wrap="truncate">
                {label}:{' '}
                {color ? <Text color={color}>{value}</Text> : <Text>{value}</Text>}
            </Text>
        </Box>
    );
}

export function StatusBar({
    activeScreen,
    uiMode,
    runStatus,
    currentStage,
    statusMessage
}: {
    activeScreen: ScreenId;
    uiMode: TuiMode;
    runStatus: string;
    currentStage: string | null;
    statusMessage: string;
}): React.JSX.Element {
    const runColor = runStatus === 'failed' ? 'red' : runStatus === 'running' ? 'green' : 'white';

    return (
        <Box borderStyle="round" borderColor="gray" paddingX={2} flexDirection="column" width="100%" minWidth={0}>
            <Box flexDirection="row" width="100%" minWidth={0}>
                <StatusCell label="Раздел" value={activeScreen} color="cyan" />
                <StatusCell label="Режим" value={uiMode} color="yellow" />
                <StatusCell label="Run" value={runStatus} color={runColor} />
                <StatusCell label="Stage" value={currentStage || 'n/a'} />
            </Box>
            <Text wrap="truncate">{statusMessage}</Text>
        </Box>
    );
}
