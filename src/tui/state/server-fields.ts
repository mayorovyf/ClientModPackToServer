import type { MessageKey } from '../../i18n/catalog.js';
import type { Translator } from '../../i18n/types.js';

import type { ServerManagerState } from '../hooks/use-server-manager.js';
import type { ServerFormState } from './app-state.js';

export type ServerFieldKey =
    | 'targetDir'
    | 'coreType'
    | 'minecraftVersion'
    | 'loaderVersion'
    | 'javaPath'
    | 'jvmArgs'
    | 'explicitEntrypointPath'
    | 'acceptEula'
    | 'useLatestBuild'
    | 'installCore'
    | 'applyEntrypointToValidation'
    | 'launchServer'
    | 'stopServer'
    | 'clearLogs';

export interface ServerFieldDefinition {
    key: ServerFieldKey;
    label: string;
    value: string;
    kind: 'text' | 'toggle' | 'enum' | 'action';
    description: string;
    activeOptionId?: string | null;
}

export interface ServerFieldDetails {
    title: string;
    overview: string;
    note?: string;
}

export const SERVER_CORE_VALUES = ['fabric', 'forge', 'neoforge'] as const;

type T = Translator<MessageKey>;

const SERVER_FIELD_DETAILS_KEYS: Record<
    ServerFieldKey,
    { titleKey: MessageKey; overviewKey: MessageKey; noteKey?: MessageKey }
> = {
    targetDir: {
        titleKey: 'field.server.targetDir.title',
        overviewKey: 'field.server.targetDir.overview',
        noteKey: 'field.server.targetDir.note'
    },
    coreType: {
        titleKey: 'field.server.coreType.title',
        overviewKey: 'field.server.coreType.overview'
    },
    minecraftVersion: {
        titleKey: 'field.server.minecraftVersion.title',
        overviewKey: 'field.server.minecraftVersion.overview'
    },
    loaderVersion: {
        titleKey: 'field.server.loaderVersion.title',
        overviewKey: 'field.server.loaderVersion.overview'
    },
    javaPath: {
        titleKey: 'field.server.javaPath.title',
        overviewKey: 'field.server.javaPath.overview'
    },
    jvmArgs: {
        titleKey: 'field.server.jvmArgs.title',
        overviewKey: 'field.server.jvmArgs.overview',
        noteKey: 'field.server.jvmArgs.note'
    },
    explicitEntrypointPath: {
        titleKey: 'field.server.explicitEntrypointPath.title',
        overviewKey: 'field.server.explicitEntrypointPath.overview'
    },
    acceptEula: {
        titleKey: 'field.server.acceptEula.title',
        overviewKey: 'field.server.acceptEula.overview'
    },
    useLatestBuild: {
        titleKey: 'field.server.useLatestBuild.title',
        overviewKey: 'field.server.useLatestBuild.overview'
    },
    installCore: {
        titleKey: 'field.server.installCore.title',
        overviewKey: 'field.server.installCore.overview'
    },
    applyEntrypointToValidation: {
        titleKey: 'field.server.applyEntrypointToValidation.title',
        overviewKey: 'field.server.applyEntrypointToValidation.overview'
    },
    launchServer: {
        titleKey: 'field.server.launchServer.title',
        overviewKey: 'field.server.launchServer.overview'
    },
    stopServer: {
        titleKey: 'field.server.stopServer.title',
        overviewKey: 'field.server.stopServer.overview'
    },
    clearLogs: {
        titleKey: 'field.server.clearLogs.title',
        overviewKey: 'field.server.clearLogs.overview'
    }
};

function valueOrPlaceholder(value: string, fallback: string): string {
    return value.trim() ? value : fallback;
}

export function getServerFieldDefinitions({
    form,
    serverState,
    hasLatestBuild,
    t
}: {
    form: ServerFormState;
    serverState: ServerManagerState;
    hasLatestBuild: boolean;
    t: T;
}): ServerFieldDefinition[] {
    return [
        {
            key: 'targetDir',
            label: t('field.server.targetDir.label'),
            value: valueOrPlaceholder(form.targetDir, t('common.placeholder.notSet')),
            kind: 'text',
            description: t('field.server.targetDir.short')
        },
        {
            key: 'coreType',
            label: t('field.server.coreType.label'),
            value: form.coreType,
            kind: 'enum',
            description: t('field.server.coreType.short'),
            activeOptionId: form.coreType
        },
        {
            key: 'minecraftVersion',
            label: t('field.server.minecraftVersion.label'),
            value: valueOrPlaceholder(form.minecraftVersion, t('common.placeholder.required')),
            kind: 'text',
            description: t('field.server.minecraftVersion.short')
        },
        {
            key: 'loaderVersion',
            label: t('field.server.loaderVersion.label'),
            value: valueOrPlaceholder(form.loaderVersion, t('common.placeholder.auto')),
            kind: 'text',
            description: t('field.server.loaderVersion.short')
        },
        {
            key: 'javaPath',
            label: t('field.server.javaPath.label'),
            value: valueOrPlaceholder(form.javaPath, t('common.placeholder.javaFromPath')),
            kind: 'text',
            description: t('field.server.javaPath.short')
        },
        {
            key: 'jvmArgs',
            label: t('field.server.jvmArgs.label'),
            value: valueOrPlaceholder(form.jvmArgs, t('common.placeholder.none')),
            kind: 'text',
            description: t('field.server.jvmArgs.short')
        },
        {
            key: 'explicitEntrypointPath',
            label: t('field.server.explicitEntrypointPath.label'),
            value: form.explicitEntrypointPath || serverState.resolvedEntrypointPath || t('common.placeholder.auto'),
            kind: 'text',
            description: t('field.server.explicitEntrypointPath.short')
        },
        {
            key: 'acceptEula',
            label: t('field.server.acceptEula.label'),
            value: t(form.acceptEula ? 'common.value.on' : 'common.value.off'),
            kind: 'toggle',
            description: t('field.server.acceptEula.short'),
            activeOptionId: form.acceptEula ? 'on' : 'off'
        },
        {
            key: 'useLatestBuild',
            label: t('field.server.useLatestBuild.label'),
            value: t(hasLatestBuild ? 'common.value.available' : 'common.value.missing'),
            kind: 'action',
            description: t('field.server.useLatestBuild.short'),
            activeOptionId: hasLatestBuild ? 'available' : 'missing'
        },
        {
            key: 'installCore',
            label: t(serverState.installStatus === 'installing'
                ? 'field.server.installCore.label.busy'
                : 'field.server.installCore.label.ready'),
            value: t(serverState.installStatus === 'installing' ? 'common.value.busy' : 'common.value.ready'),
            kind: 'action',
            description: t('field.server.installCore.short'),
            activeOptionId: serverState.installStatus === 'installing' ? 'busy' : 'ready'
        },
        {
            key: 'applyEntrypointToValidation',
            label: t('field.server.applyEntrypointToValidation.label'),
            value: t(serverState.resolvedEntrypointPath ? 'common.value.available' : 'common.value.missing'),
            kind: 'action',
            description: t('field.server.applyEntrypointToValidation.short'),
            activeOptionId: serverState.resolvedEntrypointPath ? 'available' : 'missing'
        },
        {
            key: 'launchServer',
            label: t(serverState.launchStatus === 'running'
                ? 'field.server.launchServer.label.busy'
                : 'field.server.launchServer.label.ready'),
            value: t(serverState.launchStatus === 'running' ? 'common.value.busy' : 'common.value.ready'),
            kind: 'action',
            description: t('field.server.launchServer.short'),
            activeOptionId: serverState.launchStatus === 'running' ? 'busy' : 'ready'
        },
        {
            key: 'stopServer',
            label: t('field.server.stopServer.label'),
            value: t(serverState.launchStatus === 'running' || serverState.launchStatus === 'starting'
                ? 'common.value.ready'
                : 'common.value.idle'),
            kind: 'action',
            description: t('field.server.stopServer.short'),
            activeOptionId: serverState.launchStatus === 'running' || serverState.launchStatus === 'starting' ? 'ready' : 'idle'
        },
        {
            key: 'clearLogs',
            label: t('field.server.clearLogs.label'),
            value: t('common.value.ready'),
            kind: 'action',
            description: t('field.server.clearLogs.short'),
            activeOptionId: 'ready'
        }
    ];
}

export function getServerFieldDetails(fieldKey: ServerFieldKey, t: T): ServerFieldDetails {
    const meta = SERVER_FIELD_DETAILS_KEYS[fieldKey];
    const details: ServerFieldDetails = {
        title: t(meta.titleKey),
        overview: t(meta.overviewKey)
    };

    if (meta.noteKey) {
        details.note = t(meta.noteKey);
    }

    return details;
}
