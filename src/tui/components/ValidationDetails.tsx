import React from 'react';
import { Box, Text } from 'ink';

import type { RunFormState, RunSessionState } from '../state/app-state.js';

function DetailLine({
    label,
    value,
    color
}: {
    label: string;
    value: string;
    color?: 'green' | 'yellow' | 'red' | 'cyan' | 'white';
}): React.JSX.Element {
    return (
        <Box flexDirection="row" minWidth={0}>
            <Box width={12} minWidth={12}>
                <Text dimColor wrap="truncate">{label}</Text>
            </Box>
            <Box flexGrow={1} minWidth={0}>
                {color ? (
                    <Text color={color} wrap="wrap">{value}</Text>
                ) : (
                    <Text wrap="wrap">{value}</Text>
                )}
            </Box>
        </Box>
    );
}

export function ValidationDetails({
    form,
    session,
    height
}: {
    form: RunFormState;
    session: RunSessionState;
    height: number;
}): React.JSX.Element {
    const validation = session.lastReport?.validation || null;
    const issuePreview = validation?.issues.slice(0, 4) || [];
    const suspectedPreview = validation?.suspectedFalseRemovals.slice(0, 3) || [];
    const statusColor = validation?.status === 'passed'
        ? 'green'
        : validation?.status === 'failed' || validation?.status === 'error' || validation?.status === 'timed-out'
            ? 'red'
            : 'yellow';

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
                <Text color="greenBright" wrap="wrap">Validation Details</Text>
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <DetailLine label="Mode" value={form.validationMode} />
                    <DetailLine label="Status" value={validation?.status || 'not-run'} color={statusColor} />
                    <DetailLine label="Entrypoint" value={validation?.entrypoint?.path || form.validationEntrypointPath || '<auto>'} />
                    <DetailLine label="Duration" value={validation ? `${validation.durationMs} ms` : 'n/a'} />
                    <DetailLine label="Artifacts" value={form.validationSaveArtifacts ? 'forced on' : 'default policy'} />
                </Box>
            </Box>

            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">Issues</Text>
                {issuePreview.length > 0 ? (
                    issuePreview.map((issue, index) => (
                        <Box key={`${issue.kind}-${index}`} flexDirection="column" minWidth={0}>
                            <Text color="whiteBright" wrap="wrap">{issue.kind}</Text>
                            <Text dimColor wrap="wrap">{issue.message}</Text>
                        </Box>
                    ))
                ) : (
                    <Text dimColor wrap="wrap">No parsed validation issues are available yet.</Text>
                )}
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text color="cyan" wrap="wrap">Suspected false removals</Text>
                    {suspectedPreview.length > 0 ? (
                        suspectedPreview.map((item, index) => (
                            <Text key={`${item.fileName}-${index}`} dimColor wrap="wrap">
                                {`${item.fileName}: ${item.reason}`}
                            </Text>
                        ))
                    ) : (
                        <Text dimColor wrap="wrap">No suspected false removals were linked.</Text>
                    )}
                </Box>
            </Box>
        </Box>
    );
}
