import React from 'react';
import { Box, Text } from 'ink';

import type { NavigationItem, RunSessionStatus, ScreenId, TuiMode } from '../state/app-state.js';

function StatusPill({ status }: { status: RunSessionStatus }): React.JSX.Element {
    switch (status) {
        case 'running':
            return <Text backgroundColor="yellow" color="black"> BUSY </Text>;
        case 'failed':
            return <Text backgroundColor="red" color="black"> FAILED </Text>;
        case 'succeeded':
            return <Text backgroundColor="green" color="black"> DONE </Text>;
        case 'idle':
        default:
            return <Text backgroundColor="green" color="black"> READY </Text>;
    }
}

export function Sidebar({
    items,
    activeScreen,
    uiMode,
    runStatus,
    compact,
    width,
    height
}: {
    items: NavigationItem[];
    activeScreen: ScreenId;
    uiMode: TuiMode;
    runStatus: RunSessionStatus;
    compact: boolean;
    width?: number;
    height: number;
}): React.JSX.Element {
    return (
        <Box
            flexDirection="column"
            justifyContent="space-between"
            width={width ?? '100%'}
            height={height}
            borderStyle="round"
            borderColor="cyan"
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Box flexDirection="column" minWidth={0}>
                <Text color="cyanBright" wrap="truncate">{compact ? 'CMPTS' : 'ClientModPackToServer'}</Text>
                <Text dimColor wrap="truncate">{uiMode === 'simple' ? 'Простой режим' : 'Экспертный режим'}</Text>
                <Box marginTop={1}>
                    <StatusPill status={runStatus} />
                </Box>

                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    {items.map((item, index) => {
                        const isActive = item.id === activeScreen;

                        return (
                            <Box key={item.id} marginBottom={1}>
                                <Text color={isActive ? 'greenBright' : 'white'} wrap="truncate">
                                    {isActive ? '▸' : ' '} {index + 1}. {item.label}
                                </Text>
                            </Box>
                        );
                    })}
                </Box>
            </Box>

            <Box flexDirection="column" minWidth={0}>
                <Text dimColor wrap="truncate">←/→ разделы</Text>
                <Text dimColor wrap="truncate">m режим</Text>
                <Text dimColor wrap="truncate">r запуск</Text>
                <Text dimColor wrap="truncate">Ctrl+C выход</Text>
            </Box>
        </Box>
    );
}
