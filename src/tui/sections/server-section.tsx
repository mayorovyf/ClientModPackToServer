import React from 'react';

import { ServerDoctorDetails } from '../components/ServerDoctorDetails.js';
import { ServerPageDetails } from '../components/ServerPageDetails.js';
import { ServerDoctorScreen } from '../screens/ServerDoctorScreen.js';
import { ServerScreen } from '../screens/ServerScreen.js';
import { ServerLogsScreen } from '../screens/ServerLogsScreen.js';

import type { ServerManagerState } from '../hooks/use-server-manager.js';
import type { ServerFormState } from '../state/app-state.js';
import type { ServerDoctorState } from '../state/server-doctor.js';
import type { ServerFieldKey } from '../state/server-fields.js';
import type { SectionDefinition } from './types.js';

const SERVER_SETUP_FIELD_KEYS: ServerFieldKey[] = [
    'targetDir',
    'useLatestBuild',
    'coreType',
    'minecraftVersion',
    'loaderVersion',
    'javaPath',
    'jvmArgs',
    'explicitEntrypointPath',
    'acceptEula'
];

const SERVER_INSTALL_FIELD_KEYS: ServerFieldKey[] = [
    'targetDir',
    'coreType',
    'minecraftVersion',
    'loaderVersion',
    'javaPath',
    'acceptEula',
    'installCore'
];

const SERVER_LAUNCH_FIELD_KEYS: ServerFieldKey[] = [
    'targetDir',
    'javaPath',
    'jvmArgs',
    'explicitEntrypointPath',
    'acceptEula',
    'applyEntrypointToValidation',
    'launchServer',
    'stopServer'
];

export function createServerSection({
    form,
    serverState,
    doctorState,
    latestBuildDir,
    selectedServerField,
    onChange,
    onUseLatestBuild,
    onInstallCore,
    onApplyEntrypointToValidation,
    onLaunchServer,
    onStopServer,
    onClearLogs,
    onInteractionChange,
    onSelectedFieldChange
}: {
    form: ServerFormState;
    serverState: ServerManagerState;
    doctorState: ServerDoctorState | null;
    latestBuildDir: string | null;
    selectedServerField: ServerFieldKey;
    onChange: (nextForm: ServerFormState) => void;
    onUseLatestBuild: () => void;
    onInstallCore: () => void;
    onApplyEntrypointToValidation: () => void;
    onLaunchServer: () => void;
    onStopServer: () => void;
    onClearLogs: () => void;
    onInteractionChange: (isLocked: boolean) => void;
    onSelectedFieldChange: (fieldKey: ServerFieldKey) => void;
}): SectionDefinition<'server'> {
    const renderServerDetails = ({
        detailsHeight,
        pageId
    }: {
        detailsHeight: number;
        pageId: 'setup' | 'install' | 'launch';
    }) => (
        <ServerPageDetails
            pageId={pageId}
            fieldKey={selectedServerField}
            form={form}
            serverState={serverState}
            latestBuildDir={latestBuildDir}
            height={detailsHeight}
        />
    );

    return {
        id: 'server',
        label: 'Server',
        defaultPage: 'setup',
        pages: [
            {
                id: 'setup',
                label: 'Setup',
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <ServerScreen
                        key="server-setup"
                        form={form}
                        serverState={serverState}
                        latestBuildDir={latestBuildDir}
                        fieldKeys={SERVER_SETUP_FIELD_KEYS}
                        onChange={onChange}
                        onUseLatestBuild={onUseLatestBuild}
                        onInstallCore={onInstallCore}
                        onApplyEntrypointToValidation={onApplyEntrypointToValidation}
                        onLaunchServer={onLaunchServer}
                        onStopServer={onStopServer}
                        onClearLogs={onClearLogs}
                        onInteractionChange={onInteractionChange}
                        onSelectedFieldChange={onSelectedFieldChange}
                        isFocused={isContentFocused}
                        height={contentHeight}
                    />
                ),
                renderDetails: ({ detailsHeight }) => renderServerDetails({ detailsHeight, pageId: 'setup' }),
                getStatusMessage: () => serverState.resolvedEntrypointPath
                    ? 'Launcher detected; install a core or move to launch'
                    : latestBuildDir
                        ? 'Use the latest build dir or choose a custom server directory'
                        : 'Choose a target directory, core type and versions'
            },
            {
                id: 'install',
                label: 'Install Core',
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <ServerScreen
                        key="server-install"
                        form={form}
                        serverState={serverState}
                        latestBuildDir={latestBuildDir}
                        fieldKeys={SERVER_INSTALL_FIELD_KEYS}
                        onChange={onChange}
                        onUseLatestBuild={onUseLatestBuild}
                        onInstallCore={onInstallCore}
                        onApplyEntrypointToValidation={onApplyEntrypointToValidation}
                        onLaunchServer={onLaunchServer}
                        onStopServer={onStopServer}
                        onClearLogs={onClearLogs}
                        onInteractionChange={onInteractionChange}
                        onSelectedFieldChange={onSelectedFieldChange}
                        isFocused={isContentFocused}
                        height={contentHeight}
                    />
                ),
                renderDetails: ({ detailsHeight }) => renderServerDetails({ detailsHeight, pageId: 'install' }),
                getStatusMessage: () => serverState.installStatus === 'installing'
                    ? 'Installing the selected server core'
                    : serverState.lastInstall
                        ? `Installed ${serverState.lastInstall.coreType} core`
                        : 'Install the selected server core into the target directory'
            },
            {
                id: 'doctor',
                label: 'Doctor',
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <ServerDoctorScreen
                        doctorState={doctorState}
                        isFocused={isContentFocused}
                        height={contentHeight}
                    />
                ),
                renderDetails: ({ detailsHeight }) => (
                    <ServerDoctorDetails
                        doctorState={doctorState}
                        height={detailsHeight}
                    />
                ),
                getStatusMessage: () => {
                    if (!doctorState) {
                        return 'Open the doctor page to run install and launch preflight checks';
                    }

                    const errorCount = doctorState.install.findings.filter((finding) => finding.level === 'error').length
                        + doctorState.launch.findings.filter((finding) => finding.level === 'error').length;
                    const warningCount = doctorState.install.findings.filter((finding) => finding.level === 'warning').length
                        + doctorState.launch.findings.filter((finding) => finding.level === 'warning').length;

                    if (errorCount > 0) {
                        return `Doctor found ${errorCount} blocking issue(s)`;
                    }

                    if (warningCount > 0) {
                        return `Doctor passed with ${warningCount} warning(s)`;
                    }

                    return 'Install and launch preflight both pass';
                }
            },
            {
                id: 'launch',
                label: 'Launch',
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <ServerScreen
                        key="server-launch"
                        form={form}
                        serverState={serverState}
                        latestBuildDir={latestBuildDir}
                        fieldKeys={SERVER_LAUNCH_FIELD_KEYS}
                        onChange={onChange}
                        onUseLatestBuild={onUseLatestBuild}
                        onInstallCore={onInstallCore}
                        onApplyEntrypointToValidation={onApplyEntrypointToValidation}
                        onLaunchServer={onLaunchServer}
                        onStopServer={onStopServer}
                        onClearLogs={onClearLogs}
                        onInteractionChange={onInteractionChange}
                        onSelectedFieldChange={onSelectedFieldChange}
                        isFocused={isContentFocused}
                        height={contentHeight}
                    />
                ),
                renderDetails: ({ detailsHeight }) => renderServerDetails({ detailsHeight, pageId: 'launch' }),
                getStatusMessage: () => serverState.launchStatus === 'running'
                    ? 'Server process is running'
                    : serverState.resolvedEntrypointPath
                        ? 'Launcher detected; you can start the server or bind it to validation'
                        : 'Choose or install a launcher before starting the server'
            },
            {
                id: 'logs',
                label: 'Logs',
                hasDetails: false,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <ServerLogsScreen
                        serverState={serverState}
                        isFocused={isContentFocused}
                        height={contentHeight}
                    />
                ),
                getStatusMessage: () => serverState.launchStatus === 'failed'
                    ? serverState.lastError || 'Server process failed'
                    : serverState.logs.length > 0
                        ? 'Browse live server logs in the center column'
                        : 'Logs will appear here after installation or launch'
            }
        ]
    };
}
