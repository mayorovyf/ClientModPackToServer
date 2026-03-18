import React from 'react';

import { AuthorsDetails } from '../components/AuthorsDetails.js';
import { ReportsDetails } from '../components/ReportsDetails.js';
import { ReviewDetails } from '../components/ReviewDetails.js';
import { RunSummary } from '../components/RunSummary.js';
import { SettingsDetails } from '../components/SettingsDetails.js';
import { AuthorsScreen } from '../screens/AuthorsScreen.js';
import { RegistryScreen } from '../screens/RegistryScreen.js';
import { ReportsScreen } from '../screens/ReportsScreen.js';
import { ReviewScreen } from '../screens/ReviewScreen.js';
import { SettingsScreen } from '../screens/SettingsScreen.js';
import { createBuildSection } from './build-section.js';
import { createPresetsSection } from './presets-section.js';
import { createServerSection } from './server-section.js';

import type { ScreenId } from '../state/app-state.js';
import type { SectionDefinition, SectionRegistryContext } from './types.js';

export function createSectionRegistry(context: SectionRegistryContext): Record<ScreenId, SectionDefinition> {
    const {
        form,
        setForm,
        uiMode,
        setUiMode,
        showHints,
        setShowHints,
        session,
        compact,
        latestBuildDir,
        selectedRunField,
        setSelectedRunField,
        serverForm,
        setServerForm,
        serverState,
        serverDoctor,
        installServerCore,
        useLatestBuildForServer,
        applyServerEntrypointToValidation,
        launchServer,
        stopServer,
        clearServerLogs,
        selectedServerField,
        setSelectedServerField,
        presets,
        selectedPreset,
        selectedPresetId,
        setSelectedPresetId,
        applySelectedPreset,
        createPreset,
        updateSelectedPreset,
        deleteSelectedPreset,
        selectedReportRunId,
        setSelectedReportRunId,
        selectedReportEntry,
        reportHistory,
        reviewItems,
        selectedReviewItem,
        selectedReviewItemId,
        setSelectedReviewItemId,
        saveReviewOverride,
        clearReviewOverride,
        reviewOverridesPath,
        reviewNotice,
        selectedSettingsField,
        setSelectedSettingsField,
        selectedAuthorId,
        setSelectedAuthorId,
        onInteractionChange,
        onRun
    } = context;

    return {
        build: createBuildSection({
            form,
            uiMode,
            session,
            selectedRunField,
            compact,
            onChange: setForm,
            onRun,
            onInteractionChange,
            onSelectedFieldChange: setSelectedRunField
        }),
        presets: createPresetsSection({
            presets,
            selectedPreset,
            selectedPresetId,
            currentForm: form,
            onSelectedPresetIdChange: setSelectedPresetId,
            onApplyPreset: applySelectedPreset,
            onCreatePreset: createPreset,
            onUpdatePreset: updateSelectedPreset,
            onDeletePreset: deleteSelectedPreset,
            onInteractionChange
        }),
        server: createServerSection({
            form: serverForm,
            serverState,
            doctorState: serverDoctor,
            latestBuildDir,
            selectedServerField,
            onChange: setServerForm,
            onUseLatestBuild: useLatestBuildForServer,
            onInstallCore: installServerCore,
            onApplyEntrypointToValidation: applyServerEntrypointToValidation,
            onLaunchServer: launchServer,
            onStopServer: stopServer,
            onClearLogs: clearServerLogs,
            onInteractionChange,
            onSelectedFieldChange: setSelectedServerField
        }),
        registry: {
            id: 'registry',
            label: 'Registry',
            defaultPage: 'overview',
            pages: [
                {
                    id: 'overview',
                    label: 'Overview',
                    hasDetails: true,
                    renderContent: ({ contentHeight, isContentFocused }) => (
                        <RegistryScreen
                            form={form}
                            session={session}
                            compact={compact}
                            isFocused={isContentFocused}
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
                    getStatusMessage: () => session.registrySnapshot
                        ? 'Registry snapshot is loaded for the current session'
                        : form.registryMode === 'offline'
                            ? 'Registry access is disabled for new runs'
                            : 'Review registry sources and cache settings before the next run'
                }
            ]
        },
        reports: {
            id: 'reports',
            label: 'РћС‚С‡С‘С‚С‹',
            defaultPage: 'history',
            pages: [
                {
                    id: 'history',
                    label: 'History',
                    hasDetails: true,
                    renderContent: ({ contentHeight, isContentFocused }) => (
                        <ReportsScreen
                            entries={reportHistory.entries}
                            reportRootDir={reportHistory.reportRootDir}
                            loadError={reportHistory.error}
                            selectedRunId={selectedReportRunId}
                            onSelectedRunIdChange={setSelectedReportRunId}
                            isFocused={isContentFocused}
                            height={contentHeight}
                        />
                    ),
                    renderDetails: ({ detailsHeight, isDetailsFocused }) => (
                        <ReportsDetails
                            entry={selectedReportEntry}
                            reportRootDir={reportHistory.reportRootDir}
                            loadError={reportHistory.error}
                            isFocused={isDetailsFocused}
                            height={detailsHeight}
                        />
                    ),
                    getStatusMessage: () => reportHistory.error
                        || (reportHistory.entries.length > 0
                            ? `Saved reports: ${reportHistory.entries.length}`
                            : 'No saved reports were found in the current report directory')
                }
            ]
        },
        review: {
            id: 'review',
            label: 'РЎРїРѕСЂРЅС‹Рµ',
            defaultPage: 'queue',
            pages: [
                {
                    id: 'queue',
                    label: 'Queue',
                    hasDetails: true,
                    renderContent: ({ contentHeight, isContentFocused }) => (
                        <ReviewScreen
                            items={reviewItems}
                            selectedItemId={selectedReviewItemId}
                            onSelectedItemChange={setSelectedReviewItemId}
                            onSaveOverride={saveReviewOverride}
                            onClearOverride={clearReviewOverride}
                            isFocused={isContentFocused}
                            height={contentHeight}
                        />
                    ),
                    renderDetails: ({ detailsHeight, isDetailsFocused }) => (
                        <ReviewDetails
                            item={selectedReviewItem}
                            overridesPath={reviewOverridesPath}
                            notice={reviewNotice}
                            isFocused={isDetailsFocused}
                            height={detailsHeight}
                        />
                    ),
                    getStatusMessage: () => reviewItems.length > 0
                        ? 'K keep, X exclude, C clears manual override'
                        : 'Run the pipeline to populate review items'
                }
            ]
        },
        settings: {
            id: 'settings',
            label: 'РќР°СЃС‚СЂРѕР№РєРё',
            defaultPage: 'general',
            pages: [
                {
                    id: 'general',
                    label: 'General',
                    hasDetails: true,
                    renderContent: ({ contentHeight, isContentFocused }) => (
                        <SettingsScreen
                            form={form}
                            uiMode={uiMode}
                            showHints={showHints}
                            onChange={setForm}
                            onUiModeChange={setUiMode}
                            onShowHintsChange={setShowHints}
                            onInteractionChange={onInteractionChange}
                            onSelectedFieldChange={setSelectedSettingsField}
                            isFocused={isContentFocused}
                            height={contentHeight}
                        />
                    ),
                    renderDetails: ({ detailsHeight }) => (
                        <SettingsDetails
                            fieldKey={selectedSettingsField}
                            form={form}
                            uiMode={uiMode}
                            showHints={showHints}
                            height={detailsHeight}
                        />
                    ),
                    getStatusMessage: () => showHints
                        ? `Hints are visible; press M to switch from ${uiMode} mode`
                        : `Hints are hidden; press M to switch from ${uiMode} mode`
                }
            ]
        },
        authors: {
            id: 'authors',
            label: 'РђРІС‚РѕСЂС‹',
            defaultPage: 'about',
            pages: [
                {
                    id: 'about',
                    label: 'About',
                    hasDetails: true,
                    renderContent: ({ contentHeight, isContentFocused }) => (
                        <AuthorsScreen
                            selectedAuthorId={selectedAuthorId}
                            onSelectedAuthorChange={setSelectedAuthorId}
                            isFocused={isContentFocused}
                            height={contentHeight}
                        />
                    ),
                    renderDetails: ({ detailsHeight, isDetailsFocused }) => (
                        <AuthorsDetails
                            selectedAuthorId={selectedAuthorId}
                            isFocused={isDetailsFocused}
                            height={detailsHeight}
                        />
                    ),
                    getStatusMessage: () => 'Browse project authors and ownership notes'
                }
            ]
        }
    };
}
