import React from 'react';
import { Box, Text } from 'ink';

import { getServerFieldDetails } from '../state/server-fields.js';
import type { ServerFieldKey } from '../state/server-fields.js';

import type { ServerManagerState } from '../hooks/use-server-manager.js';
import type { ServerFormState } from '../state/app-state.js';

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
    if (pageId === 'setup') {
        return (
            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">Setup Summary</Text>
                <DetailLine label="Target" value={form.targetDir || '<empty>'} />
                <DetailLine label="Last build" value={latestBuildDir || 'n/a'} />
                <DetailLine label="Core" value={form.coreType} />
                <DetailLine label="Minecraft" value={form.minecraftVersion || '<required>'} />
                <DetailLine label="Loader" value={form.loaderVersion || '<auto>'} />
                <DetailLine label="Java" value={form.javaPath || 'java from PATH'} />
                <DetailLine label="Launcher" value={serverState.resolvedEntrypointPath || '<not detected>'} />
            </Box>
        );
    }

    if (pageId === 'install') {
        const notes = serverState.lastInstall?.notes.slice(-4) || [];
        return (
            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">Install Status</Text>
                <DetailLine label="Status" value={serverState.installStatus} color={serverState.installStatus === 'failed' ? 'red' : serverState.installStatus === 'installed' ? 'green' : 'yellow'} />
                <DetailLine label="Core" value={serverState.lastInstall?.coreType || form.coreType} />
                <DetailLine label="Version" value={serverState.lastInstall?.minecraftVersion || form.minecraftVersion || '<required>'} />
                <DetailLine label="Loader" value={serverState.lastInstall?.loaderVersion || form.loaderVersion || '<auto>'} />
                <DetailLine label="Artifact" value={serverState.lastInstall?.downloadedArtifactPath || 'n/a'} />
                <DetailLine label="Entrypoint" value={serverState.lastInstall?.entrypointPath || serverState.resolvedEntrypointPath || 'n/a'} />
                {notes.length > 0 ? (
                    <Box marginTop={1} flexDirection="column" minWidth={0}>
                        <Text color="cyan" wrap="wrap">Recent notes</Text>
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
            <Text color="cyan" wrap="wrap">Launch Status</Text>
            <DetailLine label="Status" value={serverState.launchStatus} color={serverState.launchStatus === 'failed' ? 'red' : serverState.launchStatus === 'running' ? 'green' : 'yellow'} />
            <DetailLine label="Launcher" value={serverState.resolvedEntrypointPath || form.explicitEntrypointPath || '<not detected>'} />
            <DetailLine label="EULA" value={form.acceptEula ? 'accepted' : 'manual'} />
            <DetailLine label="JVM args" value={form.jvmArgs || '<none>'} />
            {serverState.lastError ? <DetailLine label="Error" value={serverState.lastError} color="red" /> : null}
            <Box marginTop={1} flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">Recent logs</Text>
                {visibleLogs.length > 0 ? (
                    visibleLogs.map((line) => (
                        <Text key={line} dimColor wrap="truncate">{line}</Text>
                    ))
                ) : (
                    <Text dimColor wrap="wrap">No server logs yet.</Text>
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
    const details = getServerFieldDetails(fieldKey);

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
