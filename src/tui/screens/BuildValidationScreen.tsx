import React from 'react';
import { Box, Text } from 'ink';
import { StatusMessage } from '@inkjs/ui';

import { useT } from '../i18n/use-t.js';
import type { RunFormState, RunSessionState } from '../state/app-state.js';
import type { RunReport } from '../../types/report.js';

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
    report = null,
    isFocused,
    height
}: {
    form: RunFormState;
    session: RunSessionState;
    report?: RunReport | null;
    isFocused: boolean;
    height: number;
}): React.JSX.Element {
    const t = useT();
    const sourceReport = report || session.lastReport;
    const validation = sourceReport?.validation || null;
    const validationMode = sourceReport?.run.validationMode || form.validationMode;
    const validationTimeoutMs = sourceReport?.run.validationTimeoutMs;
    const validationEntrypointPath = sourceReport?.run.validationEntrypointPath || form.validationEntrypointPath;
    const validationSaveArtifacts = sourceReport?.run.validationSaveArtifacts;
    const reportPath = sourceReport?.run.jsonReportPath || session.reportPaths.jsonReportPath;
    const validationStatus = validation?.status || (validationMode === 'off' ? 'disabled' : 'not-run');
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
                <Text color="yellowBright">{t('screen.validation.title')}</Text>
                <Box marginTop={1} minWidth={0}>
                    <StatusMessage variant={getStatusVariant(validation?.status || null)}>
                        {validation
                            ? t('screen.validation.status.last', { status: validation.status })
                            : validationMode === 'off'
                                ? t('screen.validation.status.disabled')
                                : t('screen.validation.status.pending')}
                    </StatusMessage>
                </Box>
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text wrap="wrap">{t('screen.validation.mode', { value: validationMode })}</Text>
                    <Text wrap="wrap">{t('screen.validation.timeout', { value: validationTimeoutMs ? String(validationTimeoutMs) : form.validationTimeoutMs || t('common.placeholder.default') })}</Text>
                    <Text wrap="wrap">{t('screen.validation.entrypoint', { value: validationEntrypointPath || t('common.placeholder.autoDetect') })}</Text>
                    <Text wrap="wrap">{t('screen.validation.saveArtifacts', { value: (validationSaveArtifacts ?? form.validationSaveArtifacts) ? t('common.value.on') : t('common.value.off') })}</Text>
                    <Text wrap="wrap">{t('screen.validation.reportPath', { value: reportPath || t('common.placeholder.na') })}</Text>
                </Box>
            </Box>

            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">{t('screen.validation.result.title')}</Text>
                <Text wrap="wrap">{t('screen.validation.result.status', { value: validationStatus })}</Text>
                <Text wrap="wrap">{t('screen.validation.result.issues', { count: issueCount })}</Text>
                <Text wrap="wrap">{t('screen.validation.result.suspected', { count: suspectedFalseRemovalCount })}</Text>
                {issuePreview.length > 0 ? (
                    <Box marginTop={1} flexDirection="column" minWidth={0}>
                        <Text color="cyan" wrap="wrap">{t('screen.validation.result.issuePreview')}</Text>
                        {issuePreview.map((issue, index) => (
                            <Box key={`${issue.kind}-${index}`} flexDirection="column" minWidth={0}>
                                <Text color="whiteBright" wrap="wrap">{issue.kind}</Text>
                                <Text dimColor wrap="wrap">{issue.message}</Text>
                            </Box>
                        ))}
                    </Box>
                ) : null}
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text dimColor wrap="wrap">{t('screen.validation.hint.settings')}</Text>
                    <Text dimColor wrap="wrap">{t('screen.validation.hint.server')}</Text>
                </Box>
            </Box>
        </Box>
    );
}
