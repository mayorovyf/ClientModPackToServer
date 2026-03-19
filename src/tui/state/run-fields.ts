import type { MessageKey } from '../../i18n/catalog.js';
import type { Translator } from '../../i18n/types.js';

import type { RunFormState, TuiMode } from './app-state.js';

export type RunFieldKey =
    | 'inputPath'
    | 'outputPath'
    | 'serverDirName'
    | 'reportDir'
    | 'runIdPrefix'
    | 'dryRun'
    | 'profile'
    | 'deepCheckMode'
    | 'validationMode'
    | 'validationTimeoutMs'
    | 'validationEntrypointPath'
    | 'validationSaveArtifacts'
    | 'registryMode'
    | 'run';

export interface RunFieldDefinition {
    key: RunFieldKey;
    label: string;
    value: string;
    kind: 'text' | 'toggle' | 'enum' | 'action';
    description: string;
    activeOptionId?: string | null;
}

export interface RunFieldOptionDescription {
    id: string;
    label: string;
    description: string;
}

export interface RunFieldDetails {
    title: string;
    overview: string;
    options: RunFieldOptionDescription[];
    note?: string;
}

export const PROFILE_VALUES = ['safe', 'balanced', 'aggressive'] as const;
export const DEEP_CHECK_VALUES = ['auto', 'off', 'force'] as const;
export const VALIDATION_VALUES = ['off', 'auto', 'require', 'force'] as const;
export const REGISTRY_VALUES = ['auto', 'offline', 'refresh', 'pinned'] as const;

type T = Translator<MessageKey>;

interface RunFieldDetailsMeta {
    titleKey: MessageKey;
    overviewKey: MessageKey;
    options: Array<{
        id: string;
        label: string;
        labelIsKey?: boolean;
        descriptionKey: MessageKey;
    }>;
    noteKey?: MessageKey;
}

const RUN_FIELD_DETAILS_META: Record<RunFieldKey, RunFieldDetailsMeta> = {
    inputPath: {
        titleKey: 'field.run.inputPath.title',
        overviewKey: 'field.run.inputPath.overview',
        options: [
            { id: 'empty', label: 'common.option.empty', labelIsKey: true, descriptionKey: 'field.run.inputPath.option.empty' },
            { id: 'pathSet', label: 'common.option.pathSet', labelIsKey: true, descriptionKey: 'field.run.inputPath.option.pathSet' }
        ],
        noteKey: 'field.run.inputPath.note'
    },
    outputPath: {
        titleKey: 'field.run.outputPath.title',
        overviewKey: 'field.run.outputPath.overview',
        options: [
            { id: 'default', label: 'common.option.default', labelIsKey: true, descriptionKey: 'field.run.outputPath.option.default' },
            { id: 'customPath', label: 'common.option.customPath', labelIsKey: true, descriptionKey: 'field.run.outputPath.option.customPath' }
        ]
    },
    serverDirName: {
        titleKey: 'field.run.serverDirName.title',
        overviewKey: 'field.run.serverDirName.overview',
        options: [
            { id: 'auto', label: 'common.option.auto', labelIsKey: true, descriptionKey: 'field.run.serverDirName.option.auto' },
            { id: 'customName', label: 'common.option.customName', labelIsKey: true, descriptionKey: 'field.run.serverDirName.option.customName' }
        ],
        noteKey: 'field.run.serverDirName.note'
    },
    reportDir: {
        titleKey: 'field.run.reportDir.title',
        overviewKey: 'field.run.reportDir.overview',
        options: [
            { id: 'default', label: 'common.option.default', labelIsKey: true, descriptionKey: 'field.run.reportDir.option.default' },
            { id: 'customPath', label: 'common.option.customPath', labelIsKey: true, descriptionKey: 'field.run.reportDir.option.customPath' }
        ]
    },
    runIdPrefix: {
        titleKey: 'field.run.runIdPrefix.title',
        overviewKey: 'field.run.runIdPrefix.overview',
        options: [
            { id: 'default', label: 'common.option.default', labelIsKey: true, descriptionKey: 'field.run.runIdPrefix.option.default' },
            { id: 'customValue', label: 'common.option.customValue', labelIsKey: true, descriptionKey: 'field.run.runIdPrefix.option.customValue' }
        ]
    },
    dryRun: {
        titleKey: 'field.run.dryRun.title',
        overviewKey: 'field.run.dryRun.overview',
        options: [
            { id: 'off', label: 'common.value.off', labelIsKey: true, descriptionKey: 'field.run.dryRun.option.off' },
            { id: 'on', label: 'common.value.on', labelIsKey: true, descriptionKey: 'field.run.dryRun.option.on' }
        ]
    },
    profile: {
        titleKey: 'field.run.profile.title',
        overviewKey: 'field.run.profile.overview',
        options: [
            { id: 'safe', label: 'safe', descriptionKey: 'field.run.profile.option.safe' },
            { id: 'balanced', label: 'balanced', descriptionKey: 'field.run.profile.option.balanced' },
            { id: 'aggressive', label: 'aggressive', descriptionKey: 'field.run.profile.option.aggressive' }
        ]
    },
    deepCheckMode: {
        titleKey: 'field.run.deepCheckMode.title',
        overviewKey: 'field.run.deepCheckMode.overview',
        options: [
            { id: 'auto', label: 'auto', descriptionKey: 'field.run.deepCheckMode.option.auto' },
            { id: 'off', label: 'off', descriptionKey: 'field.run.deepCheckMode.option.off' },
            { id: 'force', label: 'force', descriptionKey: 'field.run.deepCheckMode.option.force' }
        ]
    },
    validationMode: {
        titleKey: 'field.run.validationMode.title',
        overviewKey: 'field.run.validationMode.overview',
        options: [
            { id: 'off', label: 'off', descriptionKey: 'field.run.validationMode.option.off' },
            { id: 'auto', label: 'auto', descriptionKey: 'field.run.validationMode.option.auto' },
            { id: 'require', label: 'require', descriptionKey: 'field.run.validationMode.option.require' },
            { id: 'force', label: 'force', descriptionKey: 'field.run.validationMode.option.force' }
        ]
    },
    validationTimeoutMs: {
        titleKey: 'field.run.validationTimeoutMs.title',
        overviewKey: 'field.run.validationTimeoutMs.overview',
        options: [
            { id: 'default', label: 'common.option.default', labelIsKey: true, descriptionKey: 'field.run.validationTimeoutMs.option.default' },
            { id: 'customValue', label: 'common.option.customValue', labelIsKey: true, descriptionKey: 'field.run.validationTimeoutMs.option.customValue' }
        ]
    },
    validationEntrypointPath: {
        titleKey: 'field.run.validationEntrypointPath.title',
        overviewKey: 'field.run.validationEntrypointPath.overview',
        options: [
            { id: 'auto', label: 'common.option.auto', labelIsKey: true, descriptionKey: 'field.run.validationEntrypointPath.option.auto' },
            { id: 'customPath', label: 'common.option.customPath', labelIsKey: true, descriptionKey: 'field.run.validationEntrypointPath.option.customPath' }
        ]
    },
    validationSaveArtifacts: {
        titleKey: 'field.run.validationSaveArtifacts.title',
        overviewKey: 'field.run.validationSaveArtifacts.overview',
        options: [
            { id: 'off', label: 'common.value.off', labelIsKey: true, descriptionKey: 'field.run.validationSaveArtifacts.option.off' },
            { id: 'on', label: 'common.value.on', labelIsKey: true, descriptionKey: 'field.run.validationSaveArtifacts.option.on' }
        ]
    },
    registryMode: {
        titleKey: 'field.run.registryMode.title',
        overviewKey: 'field.run.registryMode.overview',
        options: [
            { id: 'auto', label: 'auto', descriptionKey: 'field.run.registryMode.option.auto' },
            { id: 'offline', label: 'offline', descriptionKey: 'field.run.registryMode.option.offline' },
            { id: 'refresh', label: 'refresh', descriptionKey: 'field.run.registryMode.option.refresh' },
            { id: 'pinned', label: 'pinned', descriptionKey: 'field.run.registryMode.option.pinned' }
        ]
    },
    run: {
        titleKey: 'field.run.run.title',
        overviewKey: 'field.run.run.overview',
        options: [
            { id: 'ready', label: 'common.option.ready', labelIsKey: true, descriptionKey: 'field.run.run.option.ready' },
            { id: 'busy', label: 'common.option.busy', labelIsKey: true, descriptionKey: 'field.run.run.option.busy' }
        ],
        noteKey: 'field.run.run.note'
    }
};

function getPlaceholder(t: T, key: MessageKey): string {
    return t(key);
}

function getRunFieldValueLabel(value: string, t: T): string {
    return value === 'on' || value === 'off' || value === 'ready' || value === 'busy'
        ? t(`common.value.${value}` as MessageKey)
        : value;
}

export function getRunFieldDefinitions(
    form: RunFormState,
    uiMode: TuiMode,
    isRunning: boolean,
    t: T
): RunFieldDefinition[] {
    const fields: RunFieldDefinition[] = [
        {
            key: 'inputPath',
            label: t('field.run.inputPath.label'),
            value: form.inputPath || getPlaceholder(t, 'common.placeholder.notSet'),
            kind: 'text',
            description: t('field.run.inputPath.short'),
            activeOptionId: form.inputPath.trim() ? 'pathSet' : 'empty'
        },
        {
            key: 'outputPath',
            label: t('field.run.outputPath.label'),
            value: form.outputPath || getPlaceholder(t, 'common.placeholder.default'),
            kind: 'text',
            description: t('field.run.outputPath.short'),
            activeOptionId: form.outputPath.trim() ? 'customPath' : 'default'
        },
        {
            key: 'serverDirName',
            label: t('field.run.serverDirName.label'),
            value: form.serverDirName || getPlaceholder(t, 'common.placeholder.auto'),
            kind: 'text',
            description: t('field.run.serverDirName.short'),
            activeOptionId: form.serverDirName.trim() ? 'customName' : 'auto'
        },
        {
            key: 'reportDir',
            label: t('field.run.reportDir.label'),
            value: form.reportDir || getPlaceholder(t, 'common.placeholder.default'),
            kind: 'text',
            description: t('field.run.reportDir.short'),
            activeOptionId: form.reportDir.trim() ? 'customPath' : 'default'
        },
        {
            key: 'runIdPrefix',
            label: t('field.run.runIdPrefix.label'),
            value: form.runIdPrefix || getPlaceholder(t, 'common.placeholder.default'),
            kind: 'text',
            description: t('field.run.runIdPrefix.short'),
            activeOptionId: form.runIdPrefix.trim() ? 'customValue' : 'default'
        },
        {
            key: 'dryRun',
            label: t('field.run.dryRun.label'),
            value: getRunFieldValueLabel(form.dryRun ? 'on' : 'off', t),
            kind: 'toggle',
            description: t('field.run.dryRun.short'),
            activeOptionId: form.dryRun ? 'on' : 'off'
        }
    ];

    if (uiMode === 'expert') {
        fields.push(
            {
                key: 'profile',
                label: t('field.run.profile.label'),
                value: form.profile,
                kind: 'enum',
                description: t('field.run.profile.short'),
                activeOptionId: form.profile
            },
            {
                key: 'deepCheckMode',
                label: t('field.run.deepCheckMode.label'),
                value: form.deepCheckMode,
                kind: 'enum',
                description: t('field.run.deepCheckMode.short'),
                activeOptionId: form.deepCheckMode
            },
            {
                key: 'validationMode',
                label: t('field.run.validationMode.label'),
                value: form.validationMode,
                kind: 'enum',
                description: t('field.run.validationMode.short'),
                activeOptionId: form.validationMode
            },
            {
                key: 'validationTimeoutMs',
                label: t('field.run.validationTimeoutMs.label'),
                value: form.validationTimeoutMs || getPlaceholder(t, 'common.placeholder.default'),
                kind: 'text',
                description: t('field.run.validationTimeoutMs.short'),
                activeOptionId: form.validationTimeoutMs.trim() ? 'customValue' : 'default'
            },
            {
                key: 'validationEntrypointPath',
                label: t('field.run.validationEntrypointPath.label'),
                value: form.validationEntrypointPath || getPlaceholder(t, 'common.placeholder.auto'),
                kind: 'text',
                description: t('field.run.validationEntrypointPath.short'),
                activeOptionId: form.validationEntrypointPath.trim() ? 'customPath' : 'auto'
            },
            {
                key: 'validationSaveArtifacts',
                label: t('field.run.validationSaveArtifacts.label'),
                value: getRunFieldValueLabel(form.validationSaveArtifacts ? 'on' : 'off', t),
                kind: 'toggle',
                description: t('field.run.validationSaveArtifacts.short'),
                activeOptionId: form.validationSaveArtifacts ? 'on' : 'off'
            },
            {
                key: 'registryMode',
                label: t('field.run.registryMode.label'),
                value: form.registryMode,
                kind: 'enum',
                description: t('field.run.registryMode.short'),
                activeOptionId: form.registryMode
            }
        );
    }

    const runState = isRunning ? 'busy' : 'ready';

    fields.push({
        key: 'run',
        label: t(isRunning ? 'field.run.run.label.busy' : 'field.run.run.label.ready'),
        value: getRunFieldValueLabel(runState, t),
        kind: 'action',
        description: t('field.run.run.short'),
        activeOptionId: runState
    });

    return fields;
}

export function getRunFieldDetails(fieldKey: RunFieldKey, t: T): RunFieldDetails {
    const meta = RUN_FIELD_DETAILS_META[fieldKey];

    const details: RunFieldDetails = {
        title: t(meta.titleKey),
        overview: t(meta.overviewKey),
        options: meta.options.map((option) => ({
            id: option.id,
            label: option.labelIsKey ? t(option.label as MessageKey) : option.label,
            description: t(option.descriptionKey)
        }))
    };

    if (meta.noteKey) {
        details.note = t(meta.noteKey);
    }

    return details;
}
