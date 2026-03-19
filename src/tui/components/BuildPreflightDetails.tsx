import React from 'react';
import { Box, Text } from 'ink';

import type { RunPreflightCheck, RunPreflightSummary } from '../state/run-preflight.js';

function DetailLine({
    label,
    value,
    valueColor,
    wrapMode = 'wrap'
}: {
    label: string;
    value: string;
    valueColor?: 'green' | 'yellow' | 'red' | 'white';
    wrapMode?: 'truncate' | 'wrap';
}): React.JSX.Element {
    return (
        <Box flexDirection="row" minWidth={0}>
            <Box width={11} minWidth={11}>
                <Text dimColor wrap="truncate">{label}</Text>
            </Box>
            <Box flexGrow={1} minWidth={0}>
                {valueColor ? (
                    <Text color={valueColor} wrap={wrapMode}>{value}</Text>
                ) : (
                    <Text wrap={wrapMode}>{value}</Text>
                )}
            </Box>
        </Box>
    );
}

function getSeverityColor(severity: RunPreflightCheck['severity'] | null): 'green' | 'yellow' | 'red' | 'white' {
    switch (severity) {
        case 'error':
            return 'red';
        case 'warning':
            return 'yellow';
        case 'ok':
            return 'green';
        default:
            return 'white';
    }
}

function getSeverityLabel(severity: RunPreflightCheck['severity'] | null): string {
    switch (severity) {
        case 'error':
            return 'blocker';
        case 'warning':
            return 'warning';
        case 'ok':
            return 'ok';
        default:
            return 'n/a';
    }
}

export function BuildPreflightDetails({
    selectedCheck,
    summary,
    height,
    isFocused
}: {
    selectedCheck: RunPreflightCheck | null;
    summary: RunPreflightSummary;
    height: number;
    isFocused: boolean;
}): React.JSX.Element {
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
                <Text color="greenBright" wrap="truncate">
                    {selectedCheck?.title || 'Preflight details'}
                </Text>
                {selectedCheck ? (
                    <Box marginTop={1} flexDirection="column" minWidth={0}>
                        <DetailLine label="Status" value={getSeverityLabel(selectedCheck.severity)} valueColor={getSeverityColor(selectedCheck.severity)} />
                        <DetailLine label="Summary" value={selectedCheck.summary} />
                        <DetailLine label="Details" value={selectedCheck.details} />
                    </Box>
                ) : (
                    <Box marginTop={1} minWidth={0}>
                        <Text dimColor wrap="wrap">Select a preflight check to inspect its details.</Text>
                    </Box>
                )}
            </Box>

            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">Summary</Text>
                <DetailLine label="Can run" value={summary.canRun ? 'yes' : 'no'} valueColor={summary.canRun ? 'green' : 'red'} />
                <DetailLine label="OK" value={String(summary.ok)} valueColor="green" />
                <DetailLine label="Warn" value={String(summary.warnings)} valueColor="yellow" />
                <DetailLine label="Block" value={String(summary.errors)} valueColor={summary.errors > 0 ? 'red' : 'white'} />
            </Box>
        </Box>
    );
}
