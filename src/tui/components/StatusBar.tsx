import React from 'react';
import { Box, Text } from 'ink';

import { useT } from '../i18n/use-t.js';

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
    activePageLabel,
    focusedColumn,
    uiMode,
    runStatus,
    currentStage,
    statusMessage
}: {
    activeScreenLabel: string;
    activePageLabel: string;
    focusedColumn: FocusedColumn;
    uiMode: TuiMode;
    runStatus: string;
    currentStage: string | null;
    statusMessage: string;
}): React.JSX.Element {
    const t = useT();
    const runColor = runStatus === 'failed' ? 'red' : runStatus === 'running' ? 'green' : 'white';
    const focusLabel = focusedColumn === 'sidebar'
        ? t('statusbar.focus.sidebar')
        : focusedColumn === 'content'
            ? t('statusbar.focus.content')
            : t('statusbar.focus.details');
    const modeLabel = uiMode === 'simple' ? t('mode.simple') : t('mode.expert');
    const runLabel = runStatus === 'running'
        ? t('statusbar.run.running')
        : runStatus === 'failed'
            ? t('statusbar.run.failed')
            : runStatus === 'succeeded'
                ? t('statusbar.run.succeeded')
                : t('statusbar.run.idle');
    const messageColor = runStatus === 'failed' ? 'red' : undefined;

    return (
        <Box borderStyle="round" borderColor="gray" paddingX={2} flexDirection="column" width="100%" minWidth={0}>
            <Box flexDirection="row" width="100%" minWidth={0}>
                <StatusCell label={t('statusbar.section')} value={activeScreenLabel} color="cyan" />
                <StatusCell label={t('statusbar.focus')} value={focusLabel} color="green" />
                <StatusCell label={t('statusbar.mode')} value={modeLabel} color="yellow" />
                <StatusCell label={t('statusbar.page')} value={activePageLabel} color="cyan" />
                <StatusCell label={t('statusbar.run')} value={runLabel} color={runColor} />
                <StatusCell label={t('statusbar.stage')} value={currentStage || 'n/a'} />
            </Box>
            {messageColor ? (
                <Text color={messageColor} wrap="truncate">{statusMessage}</Text>
            ) : (
                <Text wrap="truncate">{statusMessage}</Text>
            )}
        </Box>
    );
}
