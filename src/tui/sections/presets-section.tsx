import React from 'react';

import { PresetComparisonDetails } from '../components/PresetComparisonDetails.js';
import { PresetDetails } from '../components/PresetDetails.js';
import { PresetsScreen } from '../screens/PresetsScreen.js';

import type { RunFormState } from '../state/app-state.js';
import type { RunPreset } from '../state/presets.js';
import type { SectionDefinition } from './types.js';

export function createPresetsSection({
    presets,
    selectedPreset,
    selectedPresetId,
    currentForm,
    onSelectedPresetIdChange,
    onApplyPreset,
    onCreatePreset,
    onUpdatePreset,
    onDeletePreset,
    onInteractionChange
}: {
    presets: RunPreset[];
    selectedPreset: RunPreset | null;
    selectedPresetId: string;
    currentForm: RunFormState;
    onSelectedPresetIdChange: (presetId: string) => void;
    onApplyPreset: () => void;
    onCreatePreset: (name: string) => void;
    onUpdatePreset: () => void;
    onDeletePreset: () => void;
    onInteractionChange: (isLocked: boolean) => void;
}): SectionDefinition<'presets'> {
    return {
        id: 'presets',
        label: 'Presets',
        defaultPage: 'list',
        pages: [
            {
                id: 'list',
                label: 'Saved',
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <PresetsScreen
                        key="presets-list"
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
                    <PresetDetails
                        preset={selectedPreset}
                        height={detailsHeight}
                    />
                ),
                getStatusMessage: () => presets.length > 0
                    ? 'Enter applies preset, N saves current form, U updates, D deletes'
                    : 'Press N to save the current run form as a preset'
            },
            {
                id: 'details',
                label: 'Details',
                hasDetails: true,
                renderContent: ({ contentHeight }) => (
                    <PresetDetails
                        preset={selectedPreset}
                        height={contentHeight}
                    />
                ),
                renderDetails: ({ detailsHeight }) => (
                    <PresetComparisonDetails
                        preset={selectedPreset}
                        currentForm={currentForm}
                        height={detailsHeight}
                    />
                ),
                getStatusMessage: () => selectedPreset
                    ? `Preset details: ${selectedPreset.name}`
                    : 'No preset is selected yet'
            }
        ]
    };
}
