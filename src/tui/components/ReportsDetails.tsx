import React from 'react';
import { Box, Text } from 'ink';

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
    valueColor
}: {
    label: string;
    value: string;
    valueColor?: 'green' | 'yellow' | 'red' | 'cyan' | 'white';
}): React.JSX.Element {
    return (
        <Box flexDirection="row" minWidth={0}>
            <Box width={12} minWidth={12}>
                <Text dimColor wrap="truncate">{label}</Text>
            </Box>
            <Box flexGrow={1} minWidth={0}>
                {valueColor ? (
                    <Text color={valueColor} wrap="wrap">{value}</Text>
                ) : (
                    <Text wrap="wrap">{value}</Text>
                )}
            </Box>
        </Box>
    );
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
                    {entry ? entry.runId : 'История запусков'}
                </Text>
                {entry?.serverDirName ? (
                    <Text dimColor wrap="wrap">{entry.serverDirName}</Text>
                ) : null}
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <DetailLine label="Корень" value={reportRootDir} />
                    {loadError ? <DetailLine label="Ошибка" value={loadError} valueColor="red" /> : null}
                    {!entry && !loadError ? (
                        <DetailLine label="Статус" value="Запуски в этой папке пока не найдены" valueColor="yellow" />
                    ) : null}
                    {entry ? (
                        <>
                            <DetailLine label="Старт" value={formatDateTime(entry.startedAt)} />
                            <DetailLine label="Финиш" value={formatDateTime(entry.completedAt)} />
                            <DetailLine label="Инстанс" value={entry.instancePath || 'n/a'} />
                            <DetailLine label="Сервер" value={entry.buildDir || 'n/a'} />
                            <DetailLine label="Отчёты" value={entry.reportDir} />
                            <DetailLine label="Режим" value={entry.mode || 'n/a'} />
                            <DetailLine label="Dry-run" value={entry.dryRun ? 'on' : 'off'} valueColor={entry.dryRun ? 'yellow' : 'white'} />
                            <DetailLine label="Профиль" value={entry.profile || 'n/a'} />
                            <DetailLine label="Registry" value={entry.registryMode || 'n/a'} />
                            <DetailLine label="Источник" value={entry.registrySource || 'n/a'} />
                            <DetailLine label="Validation" value={entry.validationStatus || entry.validationMode || 'n/a'} />
                        </>
                    ) : null}
                </Box>
            </Box>

            {entry ? (
                <Box flexDirection="column" minWidth={0}>
                    <Text color="cyan" wrap="wrap">Сводка</Text>
                    <DetailLine label="Всего jar" value={String(entry.totalJarFiles)} />
                    <DetailLine label="KEPT" value={String(entry.kept)} valueColor="green" />
                    <DetailLine label="EXCLUDED" value={String(entry.excluded)} valueColor="red" />
                    <DetailLine label="REVIEW" value={String(entry.review)} valueColor="yellow" />
                    <DetailLine label="Warnings" value={String(entry.warnings)} />
                    <DetailLine label="Errors" value={String(entry.errors)} valueColor={entry.errors > 0 ? 'red' : 'white'} />
                </Box>
            ) : (
                <Box flexDirection="column" minWidth={0}>
                    <Text color="cyan" wrap="wrap">Файлы</Text>
                    <DetailLine label="run.json" value="Метаданные конкретного запуска" />
                    <DetailLine label="report.json" value="Полная сводка pipeline и статистика" />
                    <DetailLine label="summary.md" value="Короткий человекочитаемый итог запуска" />
                </Box>
            )}
        </Box>
    );
}
