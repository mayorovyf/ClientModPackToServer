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

function getScreenSpecificHints(activeScreen: ScreenId, compact: boolean): string[] {
    switch (activeScreen) {
        case 'build':
            return compact
                ? ['Enter edits or toggles the selected run field']
                : ['Enter edits a field or toggles the selected run option'];
        case 'presets':
            return [
                'Enter applies preset',
                'n saves current form',
                'u updates selected preset',
                'd deletes selected preset'
            ];
        case 'server':
            return [
                'Enter edits a field or runs a server action',
                'Use latest build to bind the newest build dir',
                'Use for validation copies launcher into pipeline validation'
            ];
        default:
            return [];
    }
}

export function Sidebar({
    items,
    activeScreen,
    activePageLabel,
    hasMultiplePages,
    isFocused,
    uiMode,
    runStatus,
    showHints,
    compact,
    width,
    height
}: {
    items: NavigationItem[];
    activeScreen: ScreenId;
    activePageLabel: string;
    hasMultiplePages: boolean;
    isFocused: boolean;
    uiMode: TuiMode;
    runStatus: RunSessionStatus;
    showHints: boolean;
    compact: boolean;
    width?: number;
    height: number;
}): React.JSX.Element {
    const screenSpecificHints = showHints ? getScreenSpecificHints(activeScreen, compact) : [];

    return (
        <Box
            flexDirection="column"
            justifyContent="space-between"
            width={width ?? '100%'}
            height={height}
            borderStyle="round"
            borderColor={isFocused ? 'green' : 'cyan'}
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Box flexDirection="column" minWidth={0}>
                <Text color="cyanBright" wrap="truncate">{compact ? 'CMPTS' : 'ClientModPackToServer'}</Text>
                <Text dimColor wrap="truncate">{uiMode === 'simple' ? 'Simple mode' : 'Expert mode'}</Text>
                <Text dimColor wrap="truncate">{`Page: ${activePageLabel}`}</Text>
                <Box marginTop={1}>
                    <StatusPill status={runStatus} />
                </Box>

                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    {items.map((item, index) => {
                        const isActive = item.id === activeScreen;

                        return (
                            <Box key={item.id} marginBottom={1}>
                                <Box flexDirection="row" alignItems="center" minWidth={0}>
                                    <Box width={2} minWidth={2}>
                                        <Text color={isActive ? 'greenBright' : 'white'}>
                                            {isActive ? '>' : ' '}
                                        </Text>
                                    </Box>
                                    <Box flexGrow={1} minWidth={0}>
                                        <Text color={isActive ? 'greenBright' : 'white'} wrap="truncate">
                                            {`${index + 1}. ${item.label}`}
                                        </Text>
                                    </Box>
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            </Box>

            <Box flexDirection="column" minWidth={0}>
                {showHints ? (
                    <>
                        {screenSpecificHints.map((hint) => (
                            <Text key={hint} dimColor wrap="wrap">{hint}</Text>
                        ))}
                        {hasMultiplePages ? <Text dimColor wrap="truncate">Tab/Shift+Tab switches pages</Text> : null}
                        {screenSpecificHints.length > 0 ? <Text dimColor wrap="truncate"> </Text> : null}
                        <Text dimColor wrap="truncate">Left/Right switches columns</Text>
                        <Text dimColor wrap="truncate">Up/Down moves inside active column</Text>
                        <Text dimColor wrap="truncate">1-8 opens screens</Text>
                        <Text dimColor wrap="truncate">m toggles UI mode</Text>
                        <Text dimColor wrap="truncate">r runs pipeline</Text>
                        <Text dimColor wrap="truncate">Ctrl+C exits</Text>
                    </>
                ) : null}
            </Box>
        </Box>
    );
}
