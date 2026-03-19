import React from 'react';
import { Box, Text } from 'ink';

import { useT } from '../i18n/use-t.js';
import type { RunFormState, RunSessionState } from '../state/app-state.js';
import type { RunReport } from '../../types/report.js';

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
    report = null,
    height
}: {
    form: RunFormState;
    session: RunSessionState;
    report?: RunReport | null;
    height: number;
}): React.JSX.Element {
    const t = useT();
    const sourceReport = report || session.lastReport;
    const validation = sourceReport?.validation || null;
    const validationMode = sourceReport?.run.validationMode || form.validationMode;
    const validationEntrypointPath = sourceReport?.run.validationEntrypointPath || form.validationEntrypointPath;
    const validationSaveArtifacts = sourceReport?.run.validationSaveArtifacts;
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
                <Text color="greenBright" wrap="wrap">{t('details.validation.title')}</Text>
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <DetailLine label={t('details.validation.mode')} value={validationMode} />
                    <DetailLine label={t('details.validation.status')} value={validation?.status || 'not-run'} color={statusColor} />
                    <DetailLine label={t('details.validation.entrypoint')} value={validation?.entrypoint?.path || validationEntrypointPath || t('common.placeholder.auto')} />
                    <DetailLine label={t('details.validation.duration')} value={validation ? `${validation.durationMs} ms` : t('common.placeholder.na')} />
                    <DetailLine label={t('details.validation.artifacts')} value={(validationSaveArtifacts ?? form.validationSaveArtifacts) ? t('common.value.forcedOn') : t('common.value.defaultPolicy')} />
                </Box>
            </Box>

            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">{t('details.validation.issues')}</Text>
                {issuePreview.length > 0 ? (
                    issuePreview.map((issue, index) => (
                        <Box key={`${issue.kind}-${index}`} flexDirection="column" minWidth={0}>
                            <Text color="whiteBright" wrap="wrap">{issue.kind}</Text>
                            <Text dimColor wrap="wrap">{issue.message}</Text>
                        </Box>
                    ))
                ) : (
                    <Text dimColor wrap="wrap">{t('details.validation.issues.empty')}</Text>
                )}
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text color="cyan" wrap="wrap">{t('details.validation.suspected')}</Text>
                    {suspectedPreview.length > 0 ? (
                        suspectedPreview.map((item, index) => (
                            <Text key={`${item.fileName}-${index}`} dimColor wrap="wrap">
                                {`${item.fileName}: ${item.reason}`}
                            </Text>
                        ))
                    ) : (
                        <Text dimColor wrap="wrap">{t('details.validation.suspected.empty')}</Text>
                    )}
                </Box>
            </Box>
        </Box>
    );
}
