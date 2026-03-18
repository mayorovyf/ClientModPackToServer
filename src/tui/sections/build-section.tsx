import React from 'react';

import { RunFieldDetails } from '../components/RunFieldDetails.js';
import { RunSummary } from '../components/RunSummary.js';
import { ValidationDetails } from '../components/ValidationDetails.js';
import { BuildScreen } from '../screens/BuildScreen.js';
import { BuildValidationScreen } from '../screens/BuildValidationScreen.js';

import type { RunFormState, RunSessionState, TuiMode } from '../state/app-state.js';
import type { RunFieldKey } from '../state/run-fields.js';
import type { SectionDefinition } from './types.js';

const BUILD_INPUT_FIELD_KEYS: RunFieldKey[] = ['inputPath', 'outputPath', 'serverDirName', 'reportDir', 'dryRun'];
const BUILD_RUN_FIELD_KEYS: RunFieldKey[] = ['dryRun', 'profile', 'deepCheckMode', 'validationMode', 'registryMode', 'run'];

export function createBuildSection({
    form,
    uiMode,
    session,
    selectedRunField,
    compact,
    onChange,
    onRun,
    onInteractionChange,
    onSelectedFieldChange
}: {
    form: RunFormState;
    uiMode: TuiMode;
    session: RunSessionState;
    selectedRunField: RunFieldKey;
    compact: boolean;
    onChange: (nextForm: RunFormState) => void;
    onRun: () => void;
    onInteractionChange: (isLocked: boolean) => void;
    onSelectedFieldChange: (fieldKey: RunFieldKey) => void;
}): SectionDefinition<'build'> {
    return {
        id: 'build',
        label: 'Р—Р°РїСѓСЃРє',
        defaultPage: 'inputs',
        pages: [
            {
                id: 'inputs',
                label: 'Inputs',
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
                    ? 'Input and output paths are ready for the pipeline'
                    : 'Set the instance path before starting the pipeline'
            },
            {
                id: 'run',
                label: 'Run',
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
                    ? 'Pipeline is running'
                    : form.inputPath.trim()
                        ? 'Ready to launch the pipeline with the current strategy'
                        : 'Set the instance path before launching the pipeline'
            },
            {
                id: 'validation',
                label: 'Validation',
                hasDetails: true,
                renderContent: ({ contentHeight, isContentFocused }) => (
                    <BuildValidationScreen
                        form={form}
                        session={session}
                        isFocused={isContentFocused}
                        height={contentHeight}
                    />
                ),
                renderDetails: ({ detailsHeight }) => (
                    <ValidationDetails
                        form={form}
                        session={session}
                        height={detailsHeight}
                    />
                ),
                getStatusMessage: () => {
                    const validationStatus = session.lastReport?.validation?.status || null;

                    if (validationStatus) {
                        return `Latest validation status: ${validationStatus}`;
                    }

                    return form.validationMode === 'off'
                        ? 'Validation is disabled for new runs'
                        : 'Validation settings are configured but no completed result is available yet';
                }
            }
        ]
    };
}
