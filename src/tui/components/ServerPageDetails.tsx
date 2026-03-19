import React from 'react';
import { Box, Text } from 'ink';

import { useT } from '../i18n/use-t.js';
import type { ServerManagerState } from '../hooks/use-server-manager.js';
import type { ServerFormState } from '../state/app-state.js';
import { getServerFieldDetails } from '../state/server-fields.js';
import type { ServerFieldKey } from '../state/server-fields.js';

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

function PageSummary({
    pageId,
    form,
    serverState,
    latestBuildDir
}: {
    pageId: 'setup' | 'install' | 'launch';
    form: ServerFormState;
    serverState: ServerManagerState;
    latestBuildDir: string | null;
}): React.JSX.Element {
    const t = useT();

    if (pageId === 'setup') {
        return (
            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">{t('server.summary.setup.title')}</Text>
                <DetailLine label={t('server.summary.setup.target')} value={form.targetDir || t('common.placeholder.empty')} />
                <DetailLine label={t('server.summary.setup.lastBuild')} value={latestBuildDir || t('common.placeholder.na')} />
                <DetailLine label={t('server.summary.setup.core')} value={form.coreType} />
                <DetailLine label={t('server.summary.setup.minecraft')} value={form.minecraftVersion || t('common.placeholder.required')} />
                <DetailLine label={t('server.summary.setup.loader')} value={form.loaderVersion || t('common.placeholder.auto')} />
                <DetailLine label={t('server.summary.setup.java')} value={form.javaPath || t('common.placeholder.javaFromPath')} />
                <DetailLine label={t('server.summary.setup.launcher')} value={serverState.resolvedEntrypointPath || t('common.placeholder.notDetected')} />
            </Box>
        );
    }

    if (pageId === 'install') {
        const notes = serverState.lastInstall?.notes.slice(-4) || [];

        return (
            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">{t('server.summary.install.title')}</Text>
                <DetailLine
                    label={t('server.summary.install.status')}
                    value={serverState.installStatus}
                    color={serverState.installStatus === 'failed' ? 'red' : serverState.installStatus === 'installed' ? 'green' : 'yellow'}
                />
                <DetailLine label={t('server.summary.install.core')} value={serverState.lastInstall?.coreType || form.coreType} />
                <DetailLine label={t('server.summary.install.version')} value={serverState.lastInstall?.minecraftVersion || form.minecraftVersion || t('common.placeholder.required')} />
                <DetailLine label={t('server.summary.install.loader')} value={serverState.lastInstall?.loaderVersion || form.loaderVersion || t('common.placeholder.auto')} />
                <DetailLine label={t('server.summary.install.artifact')} value={serverState.lastInstall?.downloadedArtifactPath || t('common.placeholder.na')} />
                <DetailLine label={t('server.summary.install.entrypoint')} value={serverState.lastInstall?.entrypointPath || serverState.resolvedEntrypointPath || t('common.placeholder.na')} />
                {notes.length > 0 ? (
                    <Box marginTop={1} flexDirection="column" minWidth={0}>
                        <Text color="cyan" wrap="wrap">{t('server.summary.install.notes')}</Text>
                        {notes.map((note) => (
                            <Text key={note} dimColor wrap="wrap">{note}</Text>
                        ))}
                    </Box>
                ) : null}
            </Box>
        );
    }

    const visibleLogs = serverState.logs.slice(-5);

    return (
        <Box flexDirection="column" minWidth={0}>
            <Text color="cyan" wrap="wrap">{t('server.summary.launch.title')}</Text>
            <DetailLine
                label={t('server.summary.launch.status')}
                value={serverState.launchStatus}
                color={serverState.launchStatus === 'failed' ? 'red' : serverState.launchStatus === 'running' ? 'green' : 'yellow'}
            />
            <DetailLine label={t('server.summary.launch.launcher')} value={serverState.resolvedEntrypointPath || form.explicitEntrypointPath || t('common.placeholder.notDetected')} />
            <DetailLine label={t('server.summary.launch.eula')} value={form.acceptEula ? t('common.value.accepted') : t('common.value.manual')} />
            <DetailLine label={t('server.summary.launch.jvmArgs')} value={form.jvmArgs || t('common.placeholder.none')} />
            {serverState.lastError ? <DetailLine label={t('server.summary.launch.error')} value={serverState.lastError} color="red" /> : null}
            <Box marginTop={1} flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">{t('server.summary.launch.logs')}</Text>
                {visibleLogs.length > 0 ? (
                    visibleLogs.map((line) => (
                        <Text key={line} dimColor wrap="truncate">{line}</Text>
                    ))
                ) : (
                    <Text dimColor wrap="wrap">{t('server.summary.launch.logs.empty')}</Text>
                )}
            </Box>
        </Box>
    );
}

export function ServerPageDetails({
    pageId,
    fieldKey,
    form,
    serverState,
    latestBuildDir,
    height
}: {
    pageId: 'setup' | 'install' | 'launch';
    fieldKey: ServerFieldKey;
    form: ServerFormState;
    serverState: ServerManagerState;
    latestBuildDir: string | null;
    height: number;
}): React.JSX.Element {
    const t = useT();
    const details = getServerFieldDetails(fieldKey, t);

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
                <PageSummary
                    pageId={pageId}
                    form={form}
                    serverState={serverState}
                    latestBuildDir={latestBuildDir}
                />
            </Box>

            <Box flexDirection="column" minWidth={0}>
                <Text color="greenBright" wrap="wrap">{details.title}</Text>
                <Text wrap="wrap">{details.overview}</Text>
                {details.note ? (
                    <Box marginTop={1} minWidth={0}>
                        <Text color="yellow" wrap="wrap">{details.note}</Text>
                    </Box>
                ) : null}
            </Box>
        </Box>
    );
}
