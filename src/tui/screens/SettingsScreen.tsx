import React from 'react';
import { Box, Text } from 'ink';
import { StatusMessage } from '@inkjs/ui';

import type { TuiMode } from '../state/app-state.js';

export function SettingsScreen({
    uiMode,
    cwd,
    compact,
    height
}: {
    uiMode: TuiMode;
    cwd: string;
    compact: boolean;
    height: number;
}): React.JSX.Element {
    return (
        <Box
            flexDirection="column"
            justifyContent="space-between"
            width="100%"
            height={height}
            borderStyle="round"
            borderColor="gray"
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Text color="whiteBright">Настройки</Text>
            <Box marginTop={1} minWidth={0}>
                <StatusMessage variant="info">
                    {compact
                        ? 'TUI уже использует backend runner и typed events.'
                        : 'Этот TUI уже использует backend runner и typed events. Экспертный режим будет расширяться дальше.'}
                </StatusMessage>
            </Box>
            <Box marginTop={1} flexDirection="column" minWidth={0}>
                <Text wrap="truncate">UI mode: {uiMode}</Text>
                <Text wrap="truncate">Working directory: {cwd}</Text>
                <Text>Горячие клавиши:</Text>
                <Text dimColor wrap="truncate">m: простой / экспертный режим</Text>
                <Text dimColor wrap="truncate">r: запуск pipeline</Text>
                <Text dimColor wrap="truncate">1-5: переключение экранов</Text>
                <Text dimColor wrap="truncate">Ctrl+C: выход</Text>
            </Box>
        </Box>
    );
}
