import React from 'react';
import { Box, Text } from 'ink';

import { useT } from '../i18n/use-t.js';
import type { ReportHistoryEntry } from '../state/report-history.js';

function formatDateTime(value: string | null): string {
    if (!value) {
        return 'n/a';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}

function DetailLine({
    label,
    value,
    valueColor,
    wrapMode = 'truncate'
}: {
    label: string;
    value: string;
    valueColor?: 'green' | 'yellow' | 'red' | 'cyan' | 'white';
    wrapMode?: 'truncate' | 'wrap';
}): React.JSX.Element {
    return (
        <Box flexDirection="row" minWidth={0}>
            <Box width={9} minWidth={9}>
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

function getOutcomeColor(outcomeId: string | null): 'green' | 'yellow' | 'red' | 'cyan' | 'white' {
    switch (outcomeId) {
        case 'success':
            return 'green';
        case 'diagnosable-but-not-fixable':
            return 'yellow';
        case 'not-automatable-within-boundaries':
            return 'red';
        default:
            return 'white';
    }
}

export function ReportsDetails({
    entry,
    reportRootDir,
    loadError,
    isFocused,
    height
}: {
    entry: ReportHistoryEntry | null;
    reportRootDir: string;
    loadError: string | null;
    isFocused: boolean;
    height: number;
}): React.JSX.Element {
    const t = useT();

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
                <Text color="greenBright" wrap="wrap">
                    {entry ? entry.runId : t('details.reports.title')}
                </Text>
                {entry?.serverDirName ? (
                    <Text dimColor wrap="wrap">{entry.serverDirName}</Text>
                ) : null}
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <DetailLine label={t('details.reports.root')} value={reportRootDir} />
                    {loadError ? <DetailLine label={t('details.reports.error')} value={loadError} valueColor="red" /> : null}
                    {!entry && !loadError ? (
                        <DetailLine label={t('details.reports.status')} value={t('details.reports.emptyStatus')} valueColor="yellow" />
                    ) : null}
                    {entry ? (
                        <>
                            <DetailLine label={t('details.reports.started')} value={formatDateTime(entry.startedAt)} />
                            <DetailLine label={t('details.reports.finished')} value={formatDateTime(entry.completedAt)} />
                            <DetailLine label={t('details.reports.instance')} value={entry.instancePath || t('common.placeholder.na')} />
                            <DetailLine label={t('details.reports.server')} value={entry.buildDir || t('common.placeholder.na')} />
                            <DetailLine label={t('details.reports.reports')} value={entry.reportDir} />
                            <DetailLine label={t('details.reports.mode')} value={entry.mode || t('common.placeholder.na')} />
                            <DetailLine
                                label={t('details.reports.dryRun')}
                                value={entry.dryRun ? t('common.value.on') : t('common.value.off')}
                                valueColor={entry.dryRun ? 'yellow' : 'white'}
                            />
                            <DetailLine label={t('details.reports.profile')} value={entry.profile || t('common.placeholder.na')} />
                            <DetailLine label={t('details.reports.registry')} value={entry.registryMode || t('common.placeholder.na')} />
                            <DetailLine label={t('details.reports.source')} value={entry.registrySource || t('common.placeholder.na')} />
                            <DetailLine label={t('details.reports.validation')} value={entry.validationStatus || entry.validationMode || t('common.placeholder.na')} />
                            <DetailLine
                                label={t('details.reports.outcome')}
                                value={entry.terminalOutcomeId || t('common.placeholder.na')}
                                valueColor={getOutcomeColor(entry.terminalOutcomeId)}
                            />
                            <DetailLine
                                label={t('details.reports.explanation')}
                                value={entry.terminalOutcomeExplanation || t('common.placeholder.na')}
                                wrapMode="wrap"
                            />
                            <DetailLine label={t('details.reports.candidates')} value={String(entry.candidateCount)} />
                            <DetailLine label={t('details.reports.currentCandidate')} value={entry.currentCandidateId || t('common.placeholder.na')} wrapMode="wrap" />
                            <DetailLine label={t('details.reports.recipe')} value={entry.recipePath || t('common.placeholder.na')} wrapMode="wrap" />
                            <DetailLine label={t('details.reports.candidateTrace')} value={entry.candidatesPath || t('common.placeholder.na')} wrapMode="wrap" />
                        </>
                    ) : null}
                </Box>
            </Box>

            {entry ? (
                <Box flexDirection="column" minWidth={0}>
                    <Text color="cyan" wrap="wrap">{t('details.reports.summary.title')}</Text>
                    <DetailLine label={t('details.reports.summary.totalJar')} value={String(entry.totalJarFiles)} />
                    <DetailLine label={t('details.reports.summary.kept')} value={String(entry.kept)} valueColor="green" />
                    <DetailLine label={t('details.reports.summary.excluded')} value={String(entry.excluded)} valueColor="red" />
                    <DetailLine label={t('details.reports.summary.review')} value={String(entry.review)} valueColor="yellow" />
                    <DetailLine label={t('details.reports.summary.warnings')} value={String(entry.warnings)} />
                    <DetailLine label={t('details.reports.summary.errors')} value={String(entry.errors)} valueColor={entry.errors > 0 ? 'red' : 'white'} />
                </Box>
            ) : (
                <Box flexDirection="column" minWidth={0}>
                    <Text color="cyan" wrap="wrap">{t('details.reports.files.title')}</Text>
                    <DetailLine label="run.json" value={t('details.reports.files.runJson')} />
                    <DetailLine label="report.json" value={t('details.reports.files.reportJson')} />
                    <DetailLine label="summary.md" value={t('details.reports.files.summaryMd')} />
                    <DetailLine label="recipe.json" value={t('details.reports.files.recipeJson')} />
                    <DetailLine label="candidates.json" value={t('details.reports.files.candidatesJson')} />
                </Box>
            )}
        </Box>
    );
}
