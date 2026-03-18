import React from 'react';

import type { ManualReviewAction } from '../../review/manual-overrides.js';
import type { ServerManagerState } from '../hooks/use-server-manager.js';
import type {
    RunFormState,
    RunSessionState,
    ScreenId,
    SectionPageMap,
    ServerFormState,
    TuiMode
} from '../state/app-state.js';
import type { ReportHistoryState } from '../state/report-history.js';
import type { RunPreset } from '../state/presets.js';
import type { ServerDoctorState } from '../state/server-doctor.js';
import type { ReviewItem } from '../state/review-items.js';
import type { RunFieldKey } from '../state/run-fields.js';
import type { ServerFieldKey } from '../state/server-fields.js';
import type { SettingsFieldKey } from '../state/settings-fields.js';

export interface SectionRenderProps {
    contentHeight: number;
    detailsHeight: number;
    isContentFocused: boolean;
    isDetailsFocused: boolean;
}

export interface SectionNoticeState {
    level: 'success' | 'error';
    message: string;
}

export interface SectionPageDefinition<S extends ScreenId = ScreenId> {
    id: SectionPageMap[S];
    label: string;
    hasDetails?: boolean;
    renderContent: (props: SectionRenderProps) => React.JSX.Element;
    renderDetails?: (props: SectionRenderProps) => React.JSX.Element | null;
    getStatusMessage?: () => string | null;
}

export interface SectionDefinition<S extends ScreenId = ScreenId> {
    id: S;
    label: string;
    defaultPage: SectionPageMap[S];
    pages: SectionPageDefinition<S>[];
}

export interface SectionRegistryContext {
    form: RunFormState;
    setForm: (nextForm: RunFormState) => void;
    uiMode: TuiMode;
    setUiMode: (nextMode: TuiMode) => void;
    showHints: boolean;
    setShowHints: (nextValue: boolean) => void;
    session: RunSessionState;
    compact: boolean;
    latestBuildDir: string | null;
    selectedRunField: RunFieldKey;
    setSelectedRunField: (fieldKey: RunFieldKey) => void;
    serverForm: ServerFormState;
    setServerForm: (nextForm: ServerFormState) => void;
    serverState: ServerManagerState;
    serverDoctor: ServerDoctorState | null;
    installServerCore: () => void;
    useLatestBuildForServer: () => void;
    applyServerEntrypointToValidation: () => void;
    launchServer: () => void;
    stopServer: () => void;
    clearServerLogs: () => void;
    selectedServerField: ServerFieldKey;
    setSelectedServerField: (fieldKey: ServerFieldKey) => void;
    presets: RunPreset[];
    selectedPreset: RunPreset | null;
    selectedPresetId: string;
    setSelectedPresetId: (presetId: string) => void;
    applySelectedPreset: () => void;
    createPreset: (name: string) => void;
    updateSelectedPreset: () => void;
    deleteSelectedPreset: () => void;
    selectedReportRunId: string;
    setSelectedReportRunId: (runId: string) => void;
    selectedReportEntry: ReportHistoryState['entries'][number] | null;
    reportHistory: ReportHistoryState;
    reviewItems: ReviewItem[];
    selectedReviewItem: ReviewItem | null;
    selectedReviewItemId: string;
    setSelectedReviewItemId: (itemId: string) => void;
    saveReviewOverride: (action: ManualReviewAction) => void;
    clearReviewOverride: () => void;
    reviewOverridesPath: string;
    reviewNotice: SectionNoticeState | null;
    selectedSettingsField: SettingsFieldKey;
    setSelectedSettingsField: (fieldKey: SettingsFieldKey) => void;
    selectedAuthorId: string;
    setSelectedAuthorId: (authorId: string) => void;
    onInteractionChange: (locked: boolean) => void;
    onRun: () => void;
}
