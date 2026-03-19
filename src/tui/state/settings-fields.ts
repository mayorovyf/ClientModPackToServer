import { createRequire } from 'node:module';

import type { MessageKey } from '../../i18n/catalog.js';
import type { Locale, Translator } from '../../i18n/types.js';

import type { RunFormState, TuiMode } from './app-state.js';
import { getRunFieldDetails } from './run-fields.js';
import type { RunFieldKey } from './run-fields.js';

const require = createRequire(import.meta.url);
const { DEFAULT_REMOTE_REGISTRY_MANIFEST_URL } = require('../../registry/constants.js');

export type SettingsFieldKey =
    | 'locale'
    | 'uiMode'
    | 'showHints'
    | 'outputPath'
    | 'reportDir'
    | 'serverDirName'
    | 'runIdPrefix'
    | 'profile'
    | 'deepCheckMode'
    | 'validationMode'
    | 'validationTimeoutMs'
    | 'validationEntrypointPath'
    | 'validationSaveArtifacts'
    | 'registryMode'
    | 'registryManifestUrl'
    | 'registryBundleUrl'
    | 'registryFilePath'
    | 'registryOverridesPath'
    | 'enabledEngineNames'
    | 'disabledEngineNames';

export interface SettingsFieldDefinition {
    key: SettingsFieldKey;
    label: string;
    value: string;
    kind: 'text' | 'toggle' | 'enum';
    description: string;
    activeOptionId?: string | null;
}

export interface SettingsFieldOptionDescription {
    id: string;
    label: string;
    description: string;
}

export interface SettingsFieldDetails {
    title: string;
    overview: string;
    options: SettingsFieldOptionDescription[];
    note?: string;
}

type T = Translator<MessageKey>;

interface SettingsFieldDetailsMeta {
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

const SHARED_RUN_DETAILS: Partial<Record<SettingsFieldKey, RunFieldKey>> = {
    outputPath: 'outputPath',
    reportDir: 'reportDir',
    serverDirName: 'serverDirName',
    profile: 'profile',
    deepCheckMode: 'deepCheckMode',
    validationMode: 'validationMode',
    registryMode: 'registryMode'
};

const SETTINGS_FIELD_DETAILS_META: Partial<Record<SettingsFieldKey, SettingsFieldDetailsMeta>> = {
    locale: {
        titleKey: 'field.settings.locale.title',
        overviewKey: 'field.settings.locale.overview',
        options: [
            { id: 'ru', label: 'locale.name.ru', labelIsKey: true, descriptionKey: 'field.settings.locale.option.ru' },
            { id: 'en', label: 'locale.name.en', labelIsKey: true, descriptionKey: 'field.settings.locale.option.en' }
        ]
    },
    uiMode: {
        titleKey: 'field.settings.uiMode.title',
        overviewKey: 'field.settings.uiMode.overview',
        options: [
            { id: 'simple', label: 'mode.simple', labelIsKey: true, descriptionKey: 'field.settings.uiMode.option.simple' },
            { id: 'expert', label: 'mode.expert', labelIsKey: true, descriptionKey: 'field.settings.uiMode.option.expert' }
        ]
    },
    showHints: {
        titleKey: 'field.settings.showHints.title',
        overviewKey: 'field.settings.showHints.overview',
        options: [
            { id: 'on', label: 'common.value.on', labelIsKey: true, descriptionKey: 'field.settings.showHints.option.on' },
            { id: 'off', label: 'common.value.off', labelIsKey: true, descriptionKey: 'field.settings.showHints.option.off' }
        ]
    },
    runIdPrefix: {
        titleKey: 'field.settings.runIdPrefix.title',
        overviewKey: 'field.settings.runIdPrefix.overview',
        options: [
            { id: 'default', label: 'common.option.default', labelIsKey: true, descriptionKey: 'field.settings.runIdPrefix.option.default' },
            { id: 'customValue', label: 'common.option.customValue', labelIsKey: true, descriptionKey: 'field.settings.runIdPrefix.option.customValue' }
        ]
    },
    validationTimeoutMs: {
        titleKey: 'field.settings.validationTimeoutMs.title',
        overviewKey: 'field.settings.validationTimeoutMs.overview',
        options: [
            { id: 'default', label: 'common.option.default', labelIsKey: true, descriptionKey: 'field.settings.validationTimeoutMs.option.default' },
            { id: 'customValue', label: 'common.option.customValue', labelIsKey: true, descriptionKey: 'field.settings.validationTimeoutMs.option.customValue' }
        ]
    },
    validationEntrypointPath: {
        titleKey: 'field.settings.validationEntrypointPath.title',
        overviewKey: 'field.settings.validationEntrypointPath.overview',
        options: [
            { id: 'auto', label: 'common.option.auto', labelIsKey: true, descriptionKey: 'field.settings.validationEntrypointPath.option.auto' },
            { id: 'customPath', label: 'common.option.customPath', labelIsKey: true, descriptionKey: 'field.settings.validationEntrypointPath.option.customPath' }
        ]
    },
    validationSaveArtifacts: {
        titleKey: 'field.settings.validationSaveArtifacts.title',
        overviewKey: 'field.settings.validationSaveArtifacts.overview',
        options: [
            { id: 'off', label: 'common.value.off', labelIsKey: true, descriptionKey: 'field.settings.validationSaveArtifacts.option.off' },
            { id: 'on', label: 'common.value.on', labelIsKey: true, descriptionKey: 'field.settings.validationSaveArtifacts.option.on' }
        ]
    },
    registryManifestUrl: {
        titleKey: 'field.settings.registryManifestUrl.title',
        overviewKey: 'field.settings.registryManifestUrl.overview',
        options: [
            { id: 'default', label: 'common.option.default', labelIsKey: true, descriptionKey: 'field.settings.registryManifestUrl.option.default' },
            { id: 'customValue', label: 'common.option.customValue', labelIsKey: true, descriptionKey: 'field.settings.registryManifestUrl.option.customValue' }
        ]
    },
    registryBundleUrl: {
        titleKey: 'field.settings.registryBundleUrl.title',
        overviewKey: 'field.settings.registryBundleUrl.overview',
        options: [
            { id: 'notSet', label: 'common.option.notSet', labelIsKey: true, descriptionKey: 'field.settings.registryBundleUrl.option.notSet' },
            { id: 'provided', label: 'common.option.provided', labelIsKey: true, descriptionKey: 'field.settings.registryBundleUrl.option.provided' }
        ]
    },
    registryFilePath: {
        titleKey: 'field.settings.registryFilePath.title',
        overviewKey: 'field.settings.registryFilePath.overview',
        options: [
            { id: 'default', label: 'common.option.default', labelIsKey: true, descriptionKey: 'field.settings.registryFilePath.option.default' },
            { id: 'customPath', label: 'common.option.customPath', labelIsKey: true, descriptionKey: 'field.settings.registryFilePath.option.customPath' }
        ]
    },
    registryOverridesPath: {
        titleKey: 'field.settings.registryOverridesPath.title',
        overviewKey: 'field.settings.registryOverridesPath.overview',
        options: [
            { id: 'default', label: 'common.option.default', labelIsKey: true, descriptionKey: 'field.settings.registryOverridesPath.option.default' },
            { id: 'customPath', label: 'common.option.customPath', labelIsKey: true, descriptionKey: 'field.settings.registryOverridesPath.option.customPath' }
        ]
    },
    enabledEngineNames: {
        titleKey: 'field.settings.enabledEngineNames.title',
        overviewKey: 'field.settings.enabledEngineNames.overview',
        options: [
            { id: 'default', label: 'common.option.default', labelIsKey: true, descriptionKey: 'field.settings.enabledEngineNames.option.default' },
            { id: 'customList', label: 'common.option.customList', labelIsKey: true, descriptionKey: 'field.settings.enabledEngineNames.option.customList' }
        ]
    },
    disabledEngineNames: {
        titleKey: 'field.settings.disabledEngineNames.title',
        overviewKey: 'field.settings.disabledEngineNames.overview',
        options: [
            { id: 'empty', label: 'common.option.empty', labelIsKey: true, descriptionKey: 'field.settings.disabledEngineNames.option.empty' },
            { id: 'customList', label: 'common.option.customList', labelIsKey: true, descriptionKey: 'field.settings.disabledEngineNames.option.customList' }
        ]
    }
};

export function getSettingsFieldDefinitions({
    form,
    locale,
    uiMode,
    showHints,
    t
}: {
    form: RunFormState;
    locale: Locale;
    uiMode: TuiMode;
    showHints: boolean;
    t: T;
}): SettingsFieldDefinition[] {
    const registryManifestIsDefault = !form.registryManifestUrl.trim() || form.registryManifestUrl === DEFAULT_REMOTE_REGISTRY_MANIFEST_URL;

    return [
        {
            key: 'locale',
            label: t('field.settings.locale.label'),
            value: t(locale === 'ru' ? 'locale.name.ru' : 'locale.name.en'),
            kind: 'enum',
            description: t('field.settings.locale.short'),
            activeOptionId: locale
        },
        {
            key: 'uiMode',
            label: t('field.settings.uiMode.label'),
            value: t(uiMode === 'simple' ? 'mode.simple' : 'mode.expert'),
            kind: 'enum',
            description: t('field.settings.uiMode.short'),
            activeOptionId: uiMode
        },
        {
            key: 'showHints',
            label: t('field.settings.showHints.label'),
            value: t(showHints ? 'common.value.on' : 'common.value.off'),
            kind: 'toggle',
            description: t('field.settings.showHints.short'),
            activeOptionId: showHints ? 'on' : 'off'
        },
        {
            key: 'outputPath',
            label: t('field.settings.outputPath.label'),
            value: form.outputPath || t('common.placeholder.default'),
            kind: 'text',
            description: t('field.settings.outputPath.short'),
            activeOptionId: form.outputPath.trim() ? 'customPath' : 'default'
        },
        {
            key: 'reportDir',
            label: t('field.settings.reportDir.label'),
            value: form.reportDir || t('common.placeholder.default'),
            kind: 'text',
            description: t('field.settings.reportDir.short'),
            activeOptionId: form.reportDir.trim() ? 'customPath' : 'default'
        },
        {
            key: 'serverDirName',
            label: t('field.settings.serverDirName.label'),
            value: form.serverDirName || t('common.placeholder.auto'),
            kind: 'text',
            description: t('field.settings.serverDirName.short'),
            activeOptionId: form.serverDirName.trim() ? 'customName' : 'auto'
        },
        {
            key: 'runIdPrefix',
            label: t('field.settings.runIdPrefix.label'),
            value: form.runIdPrefix || t('common.placeholder.default'),
            kind: 'text',
            description: t('field.settings.runIdPrefix.short'),
            activeOptionId: form.runIdPrefix.trim() ? 'customValue' : 'default'
        },
        {
            key: 'profile',
            label: t('field.settings.profile.label'),
            value: form.profile,
            kind: 'enum',
            description: t('field.settings.profile.short'),
            activeOptionId: form.profile
        },
        {
            key: 'deepCheckMode',
            label: t('field.settings.deepCheckMode.label'),
            value: form.deepCheckMode,
            kind: 'enum',
            description: t('field.settings.deepCheckMode.short'),
            activeOptionId: form.deepCheckMode
        },
        {
            key: 'validationMode',
            label: t('field.settings.validationMode.label'),
            value: form.validationMode,
            kind: 'enum',
            description: t('field.settings.validationMode.short'),
            activeOptionId: form.validationMode
        },
        {
            key: 'validationTimeoutMs',
            label: t('field.settings.validationTimeoutMs.label'),
            value: form.validationTimeoutMs || t('common.placeholder.default'),
            kind: 'text',
            description: t('field.settings.validationTimeoutMs.short'),
            activeOptionId: form.validationTimeoutMs.trim() ? 'customValue' : 'default'
        },
        {
            key: 'validationEntrypointPath',
            label: t('field.settings.validationEntrypointPath.label'),
            value: form.validationEntrypointPath || t('common.placeholder.auto'),
            kind: 'text',
            description: t('field.settings.validationEntrypointPath.short'),
            activeOptionId: form.validationEntrypointPath.trim() ? 'customPath' : 'auto'
        },
        {
            key: 'validationSaveArtifacts',
            label: t('field.settings.validationSaveArtifacts.label'),
            value: t(form.validationSaveArtifacts ? 'common.value.on' : 'common.value.off'),
            kind: 'toggle',
            description: t('field.settings.validationSaveArtifacts.short'),
            activeOptionId: form.validationSaveArtifacts ? 'on' : 'off'
        },
        {
            key: 'registryMode',
            label: t('field.settings.registryMode.label'),
            value: form.registryMode,
            kind: 'enum',
            description: t('field.settings.registryMode.short'),
            activeOptionId: form.registryMode
        },
        {
            key: 'registryManifestUrl',
            label: t('field.settings.registryManifestUrl.label'),
            value: registryManifestIsDefault ? t('common.placeholder.default') : form.registryManifestUrl,
            kind: 'text',
            description: t('field.settings.registryManifestUrl.short'),
            activeOptionId: registryManifestIsDefault ? 'default' : 'customValue'
        },
        {
            key: 'registryBundleUrl',
            label: t('field.settings.registryBundleUrl.label'),
            value: form.registryBundleUrl || t('common.placeholder.notSet'),
            kind: 'text',
            description: t('field.settings.registryBundleUrl.short'),
            activeOptionId: form.registryBundleUrl.trim() ? 'provided' : 'notSet'
        },
        {
            key: 'registryFilePath',
            label: t('field.settings.registryFilePath.label'),
            value: form.registryFilePath || t('common.placeholder.default'),
            kind: 'text',
            description: t('field.settings.registryFilePath.short'),
            activeOptionId: form.registryFilePath.trim() ? 'customPath' : 'default'
        },
        {
            key: 'registryOverridesPath',
            label: t('field.settings.registryOverridesPath.label'),
            value: form.registryOverridesPath || t('common.placeholder.default'),
            kind: 'text',
            description: t('field.settings.registryOverridesPath.short'),
            activeOptionId: form.registryOverridesPath.trim() ? 'customPath' : 'default'
        },
        {
            key: 'enabledEngineNames',
            label: t('field.settings.enabledEngineNames.label'),
            value: form.enabledEngineNames || t('common.placeholder.default'),
            kind: 'text',
            description: t('field.settings.enabledEngineNames.short'),
            activeOptionId: form.enabledEngineNames.trim() ? 'customList' : 'default'
        },
        {
            key: 'disabledEngineNames',
            label: t('field.settings.disabledEngineNames.label'),
            value: form.disabledEngineNames || t('common.placeholder.empty'),
            kind: 'text',
            description: t('field.settings.disabledEngineNames.short'),
            activeOptionId: form.disabledEngineNames.trim() ? 'customList' : 'empty'
        }
    ];
}

export function getSettingsFieldDetails(fieldKey: SettingsFieldKey, t: T): SettingsFieldDetails {
    const sharedFieldKey = SHARED_RUN_DETAILS[fieldKey];
    if (sharedFieldKey) {
        return getRunFieldDetails(sharedFieldKey, t);
    }

    const meta = SETTINGS_FIELD_DETAILS_META[fieldKey];
    if (!meta) {
        return {
            title: fieldKey,
            overview: fieldKey,
            options: []
        };
    }

    const details: SettingsFieldDetails = {
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
