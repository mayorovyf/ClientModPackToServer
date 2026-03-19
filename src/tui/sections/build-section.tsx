import React from 'react';

import { PresetComparisonDetails } from '../components/PresetComparisonDetails.js';
import { RunFieldDetails } from '../components/RunFieldDetails.js';
import { RunSummary } from '../components/RunSummary.js';
import { BuildScreen } from '../screens/BuildScreen.js';
import { PresetsScreen } from '../screens/PresetsScreen.js';

import type { MessageKey } from '../../i18n/catalog.js';
import type { Translator } from '../../i18n/types.js';
import type { RunFormState, RunSessionState, TuiMode } from '../state/app-state.js';
import type { RunPreset } from '../state/presets.js';
import type { RunFieldKey } from '../state/run-fields.js';
import type { SectionDefinition } from './types.js';

const BUILD_INPUT_FIELD_KEYS: RunFieldKey[] = ['inputPath', 'outputPath', 'serverDirName', 'reportDir', 'dryRun'];
const BUILD_RUN_FIELD_KEYS: RunFieldKey[] = ['dryRun', 'profile', 'deepCheckMode', 'validationMode', 'registryMode', 'run'];

export function createBuildSection({
    t,
    form,
    uiMode,
    session,
    selectedRunField,
    presets,
    selectedPreset,
    selectedPresetId,
    compact,
    onChange,
    onRun,
    onInteractionChange,
    onSelectedFieldChange,
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
    selectedRunField: RunFieldKey;
    presets: RunPreset[];
    selectedPreset: RunPreset | null;
    selectedPresetId: string;
    compact: boolean;
    onChange: (nextForm: RunFormState) => void;
    onRun: () => void;
    onInteractionChange: (isLocked: boolean) => void;
    onSelectedFieldChange: (fieldKey: RunFieldKey) => void;
    onSelectedPresetIdChange: (presetId: string) => void;
    onApplyPreset: () => void;
    onCreatePreset: (name: string) => void;
    onUpdatePreset: () => void;
    onDeletePreset: () => void;
}): SectionDefinition<'build'> {
    return {
        id: 'build',
        label: t('nav.build.label'),
        defaultPage: 'inputs',
        pages: [
            {
                id: 'inputs',
                label: t('page.build.inputs'),
                chromeColor: 'yellow',
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <BuildScreen
                        key="build-inputs"
                        form={form}
                        uiMode={uiMode}
                        session={session}
                        fieldKeys={BUILD_INPUT_FIELD_KEYS}
                        onChange={onChange}
                        onRun={onRun}
                        onInteractionChange={onInteractionChange}
                        onSelectedFieldChange={onSelectedFieldChange}
                        isFocused={isContentFocused}
                        compact={compact}
                        height={contentHeight}
                    />
                ),
                renderDetails: ({ detailsHeight }) => (
                    <RunFieldDetails
                        fieldKey={selectedRunField}
                        form={form}
                        uiMode={uiMode}
                        isRunning={session.status === 'running'}
                        isFocused={false}
                        height={detailsHeight}
                    />
                ),
                getStatusMessage: () => form.inputPath.trim()
                    ? t('section.build.inputs.ready')
                    : t('section.build.inputs.missingInput')
            },
            {
                id: 'run',
                label: t('page.build.run'),
                chromeColor: 'yellow',
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <BuildScreen
                        key="build-run"
                        form={form}
                        uiMode={uiMode}
                        session={session}
                        fieldKeys={BUILD_RUN_FIELD_KEYS}
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
                    <RunSummary
                        session={session}
                        compact={compact}
                        eventLimit={8}
                        isFocused={isDetailsFocused}
                        height={detailsHeight}
                    />
                ),
                getStatusMessage: () => session.status === 'running'
                    ? t('section.build.run.running')
                    : form.inputPath.trim()
                        ? t('section.build.run.ready')
                        : t('section.build.run.missingInput')
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
