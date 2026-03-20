import React from 'react';

import { BuildLogDetails } from '../components/BuildLogDetails.js';
import { BuildPreflightDetails } from '../components/BuildPreflightDetails.js';
import { PresetComparisonDetails } from '../components/PresetComparisonDetails.js';
import { RunFieldDetails } from '../components/RunFieldDetails.js';
import { BuildLogScreen } from '../screens/BuildLogScreen.js';
import { BuildPreflightScreen } from '../screens/BuildPreflightScreen.js';
import { BuildScreen } from '../screens/BuildScreen.js';
import { PresetsScreen } from '../screens/PresetsScreen.js';

import type { MessageKey } from '../../i18n/catalog.js';
import type { Translator } from '../../i18n/types.js';
import type { RunFormState, RunSessionState, TuiMode } from '../state/app-state.js';
import type { BuildLogItem } from '../state/build-log.js';
import type { RunPreset } from '../state/presets.js';
import type { RunPreflightCheck, RunPreflightSummary } from '../state/run-preflight.js';
import type { RunFieldKey } from '../state/run-fields.js';
import type { SectionDefinition } from './types.js';

const BUILD_PATH_FIELD_KEYS: RunFieldKey[] = ['inputPath', 'outputPath', 'serverDirName', 'reportDir', 'runIdPrefix'];
const BUILD_STRATEGY_FIELD_KEYS: RunFieldKey[] = [
    'dryRun',
    'profile',
    'deepCheckMode',
    'validationMode',
    'validationTimeoutMs',
    'validationEntrypointPath',
    'validationSaveArtifacts',
    'registryMode'
];

export function createBuildSection({
    t,
    form,
    uiMode,
    session,
    buildLogItems,
    selectedBuildLogItem,
    selectedBuildLogItemId,
    selectedRunField,
    preflightChecks,
    preflightSummary,
    selectedPreflightCheck,
    selectedPreflightCheckId,
    presets,
    selectedPreset,
    selectedPresetId,
    compact,
    onChange,
    onRun,
    onInteractionChange,
    onSelectedBuildLogItemIdChange,
    onSelectedFieldChange,
    onSelectedPreflightCheckIdChange,
    onSelectedPresetIdChange,
    onApplyPreset,
    onCreatePreset,
    onUpdatePreset,
    onDeletePreset
}: {
    t: Translator<MessageKey>;
    form: RunFormState;
    uiMode: TuiMode;
    session: RunSessionState;
    buildLogItems: BuildLogItem[];
    selectedBuildLogItem: BuildLogItem | null;
    selectedBuildLogItemId: string;
    selectedRunField: RunFieldKey;
    preflightChecks: RunPreflightCheck[];
    preflightSummary: RunPreflightSummary | null;
    selectedPreflightCheck: RunPreflightCheck | null;
    selectedPreflightCheckId: string;
    presets: RunPreset[];
    selectedPreset: RunPreset | null;
    selectedPresetId: string;
    compact: boolean;
    onChange: (nextForm: RunFormState) => void;
    onRun: () => void;
    onInteractionChange: (isLocked: boolean) => void;
    onSelectedBuildLogItemIdChange: (itemId: string) => void;
    onSelectedFieldChange: (fieldKey: RunFieldKey) => void;
    onSelectedPreflightCheckIdChange: (checkId: string) => void;
    onSelectedPresetIdChange: (presetId: string) => void;
    onApplyPreset: () => void;
    onCreatePreset: (name: string) => void;
    onUpdatePreset: () => void;
    onDeletePreset: () => void;
}): SectionDefinition<'build'> {
    const effectivePreflightSummary = preflightSummary || {
        total: 0,
        errors: 0,
        warnings: 0,
        ok: 0,
        canRun: false
    };

    return {
        id: 'build',
        label: t('nav.build.label'),
        defaultPage: 'paths',
        pages: [
            {
                id: 'paths',
                label: t('page.build.paths'),
                chromeColor: 'yellow',
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <BuildScreen
                        key="build-paths"
                        form={form}
                        uiMode={uiMode}
                        session={session}
                        fieldKeys={BUILD_PATH_FIELD_KEYS}
                        onChange={onChange}
                        onRun={onRun}
                        onInteractionChange={onInteractionChange}
                        onSelectedFieldChange={onSelectedFieldChange}
                        isFocused={isContentFocused}
                        compact={compact}
                        height={contentHeight}
                    />
                ),
                renderDetails: ({ detailsHeight, isDetailsFocused }) => (
                    <RunFieldDetails
                        fieldKey={selectedRunField}
                        form={form}
                        uiMode={uiMode}
                        isRunning={session.status === 'running'}
                        isFocused={isDetailsFocused}
                        height={detailsHeight}
                    />
                ),
                getStatusMessage: () => form.inputPath.trim()
                    ? t('section.build.paths.ready')
                    : t('section.build.paths.missingInput')
            },
            {
                id: 'strategy',
                label: t('page.build.strategy'),
                chromeColor: 'yellow',
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <BuildScreen
                        key="build-strategy"
                        form={form}
                        uiMode={uiMode}
                        session={session}
                        fieldKeys={BUILD_STRATEGY_FIELD_KEYS}
                        onChange={onChange}
                        onRun={onRun}
                        onInteractionChange={onInteractionChange}
                        onSelectedFieldChange={onSelectedFieldChange}
                        isFocused={isContentFocused}
                        compact={compact}
                        height={contentHeight}
                    />
                ),
                renderDetails: ({ detailsHeight, isDetailsFocused }) => (
                    <RunFieldDetails
                        fieldKey={selectedRunField}
                        form={form}
                        uiMode={uiMode}
                        isRunning={session.status === 'running'}
                        isFocused={isDetailsFocused}
                        height={detailsHeight}
                    />
                ),
                getStatusMessage: () => session.status === 'running'
                    ? t('section.build.strategy.running')
                    : form.inputPath.trim()
                        ? t('section.build.strategy.ready')
                        : t('section.build.strategy.missingInput')
            },
            {
                id: 'check',
                label: t('page.build.check'),
                chromeColor: 'yellow',
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <BuildPreflightScreen
                        checks={preflightChecks}
                        summary={effectivePreflightSummary}
                        selectedCheckId={selectedPreflightCheckId}
                        onSelectedCheckChange={onSelectedPreflightCheckIdChange}
                        isFocused={isContentFocused}
                        height={contentHeight}
                    />
                ),
                renderDetails: ({ detailsHeight, isDetailsFocused }) => (
                    <BuildPreflightDetails
                        selectedCheck={selectedPreflightCheck}
                        summary={effectivePreflightSummary}
                        isFocused={isDetailsFocused}
                        height={detailsHeight}
                    />
                ),
                getStatusMessage: () => effectivePreflightSummary.errors > 0
                    ? t('section.build.check.blocked', { count: effectivePreflightSummary.errors })
                    : effectivePreflightSummary.warnings > 0
                        ? t('section.build.check.warnings', { count: effectivePreflightSummary.warnings })
                        : t('section.build.check.ready')
            },
            {
                id: 'launch',
                label: t('page.build.log'),
                chromeColor: 'yellow',
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <BuildLogScreen
                        items={buildLogItems}
                        selectedItemId={selectedBuildLogItemId}
                        onSelectedItemChange={onSelectedBuildLogItemIdChange}
                        session={session}
                        isFocused={isContentFocused}
                        height={contentHeight}
                    />
                ),
                renderDetails: ({ detailsHeight, isDetailsFocused }) => (
                    <BuildLogDetails
                        item={selectedBuildLogItem}
                        isFocused={isDetailsFocused}
                        height={detailsHeight}
                    />
                ),
                getStatusMessage: () => session.status === 'running'
                    ? t('section.build.log.running')
                    : buildLogItems.some((item) => item.kind === 'event')
                        ? t('section.build.log.ready')
                        : t('section.build.log.empty')
            },
            {
                id: 'presets',
                label: t('page.build.presets'),
                chromeColor: 'blue',
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <PresetsScreen
                        key="build-presets"
                        presets={presets}
                        selectedPresetId={selectedPresetId}
                        onSelectedPresetIdChange={onSelectedPresetIdChange}
                        onApplyPreset={onApplyPreset}
                        onCreatePreset={onCreatePreset}
                        onUpdatePreset={onUpdatePreset}
                        onDeletePreset={onDeletePreset}
                        onInteractionChange={onInteractionChange}
                        isFocused={isContentFocused}
                        height={contentHeight}
                    />
                ),
                renderDetails: ({ detailsHeight }) => (
                    <PresetComparisonDetails
                        preset={selectedPreset}
                        currentForm={form}
                        height={detailsHeight}
                    />
                ),
                getStatusMessage: () => presets.length > 0
                    ? t('section.presets.list.ready')
                    : t('section.presets.list.empty')
            }
        ]
    };
}
