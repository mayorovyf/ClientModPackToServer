import React from 'react';

import { ServerDoctorDetails } from '../components/ServerDoctorDetails.js';
import { ServerPageDetails } from '../components/ServerPageDetails.js';
import { ServerDoctorScreen } from '../screens/ServerDoctorScreen.js';
import { ServerScreen } from '../screens/ServerScreen.js';
import { ServerLogsScreen } from '../screens/ServerLogsScreen.js';

import type { MessageKey } from '../../i18n/catalog.js';
import type { Translator } from '../../i18n/types.js';
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
    t,
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
    t: Translator<MessageKey>;
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
        label: t('nav.server.label'),
        defaultPage: 'setup',
        pages: [
            {
                id: 'setup',
                label: t('page.server.setup'),
                chromeColor: 'cyan',
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
                    ? t('section.server.setup.detected')
                    : latestBuildDir
                        ? t('section.server.setup.useLatestBuild')
                        : t('section.server.setup.configure')
            },
            {
                id: 'install',
                label: t('page.server.install'),
                chromeColor: 'cyan',
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
                    ? t('section.server.install.running')
                    : serverState.lastInstall
                        ? t('section.server.install.installed', { coreType: serverState.lastInstall.coreType })
                        : t('section.server.install.ready')
            },
            {
                id: 'doctor',
                label: t('page.server.doctor'),
                chromeColor: 'cyan',
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
                        return t('section.server.doctor.open');
                    }

                    const errorCount = doctorState.install.findings.filter((finding) => finding.level === 'error').length
                        + doctorState.launch.findings.filter((finding) => finding.level === 'error').length;
                    const warningCount = doctorState.install.findings.filter((finding) => finding.level === 'warning').length
                        + doctorState.launch.findings.filter((finding) => finding.level === 'warning').length;

                    if (errorCount > 0) {
                        return t('section.server.doctor.blocking', { count: errorCount });
                    }

                    if (warningCount > 0) {
                        return t('section.server.doctor.warnings', { count: warningCount });
                    }

                    return t('section.server.doctor.ok');
                }
            },
            {
                id: 'launch',
                label: t('page.server.launch'),
                chromeColor: 'cyan',
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
                    ? t('section.server.launch.running')
                    : serverState.resolvedEntrypointPath
                        ? t('section.server.launch.detected')
                        : t('section.server.launch.noLauncher')
            },
            {
                id: 'logs',
                label: t('page.server.logs'),
                chromeColor: 'cyan',
                hasDetails: false,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <ServerLogsScreen
                        serverState={serverState}
                        isFocused={isContentFocused}
                        height={contentHeight}
                    />
                ),
                getStatusMessage: () => serverState.launchStatus === 'failed'
                    ? serverState.lastError || t('section.server.logs.failed')
                    : serverState.logs.length > 0
                        ? t('section.server.logs.browse')
                        : t('section.server.logs.empty')
            }
        ]
    };
}
