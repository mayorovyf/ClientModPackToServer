import React from 'react';
import { Box, Text } from 'ink';

import type { FocusedColumn, TuiMode } from '../state/app-state.js';

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
            <Box flexDirection="row" minWidth={0}>
                <Text wrap="truncate">{`${label}:`}</Text>
                <Box marginLeft={1} flexGrow={1} minWidth={0}>
                    {color ? (
                        <Text color={color} wrap="truncate">{value}</Text>
                    ) : (
                        <Text wrap="truncate">{value}</Text>
                    )}
                </Box>
            </Box>
        </Box>
    );
}

export function StatusBar({
    activeScreenLabel,
    focusedColumn,
    uiMode,
    runStatus,
    currentStage,
    statusMessage
}: {
    activeScreenLabel: string;
    focusedColumn: FocusedColumn;
    uiMode: TuiMode;
    runStatus: string;
    currentStage: string | null;
    statusMessage: string;
}): React.JSX.Element {
    const runColor = runStatus === 'failed' ? 'red' : runStatus === 'running' ? 'green' : 'white';
    const focusLabel = focusedColumn === 'sidebar' ? 'меню' : focusedColumn === 'content' ? 'центр' : 'право';
    const messageColor = runStatus === 'failed' ? 'red' : undefined;

    return (
        <Box borderStyle="round" borderColor="gray" paddingX={2} flexDirection="column" width="100%" minWidth={0}>
            <Box flexDirection="row" width="100%" minWidth={0}>
                <StatusCell label="Раздел" value={activeScreenLabel} color="cyan" />
                <StatusCell label="Фокус" value={focusLabel} color="green" />
                <StatusCell label="Режим" value={uiMode} color="yellow" />
                <StatusCell label="Run" value={runStatus} color={runColor} />
                <StatusCell label="Stage" value={currentStage || 'n/a'} />
            </Box>
            {messageColor ? (
                <Text color={messageColor} wrap="truncate">{statusMessage}</Text>
            ) : (
                <Text wrap="truncate">{statusMessage}</Text>
            )}
        </Box>
    );
}
