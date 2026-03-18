import React from 'react';
import { Box, Text } from 'ink';
import { StatusMessage } from '@inkjs/ui';

import type { RunFormState, RunSessionState } from '../state/app-state.js';

function getStatusVariant(status: string | null): 'info' | 'success' | 'warning' | 'error' {
    switch (status) {
        case 'passed':
        case 'success':
            return 'success';
        case 'failed':
        case 'error':
            return 'error';
        case 'skipped':
            return 'warning';
        default:
            return 'info';
    }
}

export function BuildValidationScreen({
    form,
    session,
    isFocused,
    height
}: {
    form: RunFormState;
    session: RunSessionState;
    isFocused: boolean;
    height: number;
}): React.JSX.Element {
    const validation = session.lastReport?.validation || null;
    const validationStatus = validation?.status || (form.validationMode === 'off' ? 'disabled' : 'not-run');
    const issueCount = validation?.issues?.length ?? 0;
    const suspectedFalseRemovalCount = validation?.suspectedFalseRemovals?.length ?? 0;
    const issuePreview = validation?.issues.slice(0, Math.max(1, height - 18)) || [];

    return (
        <Box
            flexDirection="column"
            justifyContent="space-between"
            width="100%"
            height={height}
            borderStyle="round"
            borderColor={isFocused ? 'green' : 'yellow'}
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Box flexDirection="column" minWidth={0}>
                <Text color="yellowBright">Validation</Text>
                <Box marginTop={1} minWidth={0}>
                    <StatusMessage variant={getStatusVariant(validation?.status || null)}>
                        {validation
                            ? `Last validation status: ${validation.status}`
                            : form.validationMode === 'off'
                                ? 'Validation is disabled for new runs'
                                : 'Validation has not completed yet for the current session'}
                    </StatusMessage>
                </Box>
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text wrap="wrap">{`Mode: ${form.validationMode}`}</Text>
                    <Text wrap="wrap">{`Timeout: ${form.validationTimeoutMs || '<default>'}`}</Text>
                    <Text wrap="wrap">{`Entrypoint: ${form.validationEntrypointPath || '<auto-detect>'}`}</Text>
                    <Text wrap="wrap">{`Save artifacts: ${form.validationSaveArtifacts ? 'on' : 'off'}`}</Text>
                    <Text wrap="wrap">{`Report path: ${session.reportPaths.jsonReportPath || 'n/a'}`}</Text>
                </Box>
            </Box>

            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">Last result</Text>
                <Text wrap="wrap">{`Status: ${validationStatus}`}</Text>
                <Text wrap="wrap">{`Issues: ${issueCount}`}</Text>
                <Text wrap="wrap">{`Suspected false removals: ${suspectedFalseRemovalCount}`}</Text>
                {issuePreview.length > 0 ? (
                    <Box marginTop={1} flexDirection="column" minWidth={0}>
                        <Text color="cyan" wrap="wrap">Issue preview</Text>
                        {issuePreview.map((issue, index) => (
                            <Box key={`${issue.kind}-${index}`} flexDirection="column" minWidth={0}>
                                <Text color="whiteBright" wrap="wrap">{issue.kind}</Text>
                                <Text dimColor wrap="wrap">{issue.message}</Text>
                            </Box>
                        ))}
                    </Box>
                ) : null}
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text dimColor wrap="wrap">Advanced timeout and entrypoint settings still live in Settings.</Text>
                    <Text dimColor wrap="wrap">The Server section can publish its launcher into validation entrypoint.</Text>
                </Box>
            </Box>
        </Box>
    );
}
