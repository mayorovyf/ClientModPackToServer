import React from 'react';

import type { MessageKey } from '../../i18n/catalog.js';
import type { Locale, Translator } from '../../i18n/types.js';
import type { ManualReviewAction } from '../../review/manual-overrides.js';
import type { RunReport } from '../../types/report.js';
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
import type { ResultCompareItem, ResultCompareSummary } from '../state/result-compare.js';
import type { ResultProblemItem, ResultProblemsSummary } from '../state/result-problems.js';
import type { ServerDoctorState } from '../state/server-doctor.js';
import type { BuildLogItem } from '../state/build-log.js';
import type { ResultModItem, ResultModsSortMode } from '../state/results-mods.js';
import type { DecisionReviewState, ReviewItem } from '../state/review-items.js';
import type { RunPreflightCheck, RunPreflightSummary } from '../state/run-preflight.js';
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
    chromeColor?: string;
    frameLabel?: string | null;
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
    t: Translator<MessageKey>;
    locale: Locale;
    form: RunFormState;
    setForm: (nextForm: RunFormState) => void;
    uiMode: TuiMode;
    setLocale: (nextLocale: Locale) => void;
    setUiMode: (nextMode: TuiMode) => void;
    showHints: boolean;
    setShowHints: (nextValue: boolean) => void;
    session: RunSessionState;
    compact: boolean;
    buildLogItems?: BuildLogItem[];
    selectedBuildLogItem?: BuildLogItem | null;
    selectedBuildLogItemId?: string;
    setSelectedBuildLogItemId?: (itemId: string) => void;
    latestBuildDir: string | null;
    selectedRunField: RunFieldKey;
    setSelectedRunField: (fieldKey: RunFieldKey) => void;
    runPreflightChecks?: RunPreflightCheck[];
    runPreflightSummary?: RunPreflightSummary;
    selectedRunPreflightCheck?: RunPreflightCheck | null;
    selectedRunPreflightCheckId?: string;
    setSelectedRunPreflightCheckId?: (checkId: string) => void;
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
    selectedReport: RunReport | null;
    allResultModItems?: ResultModItem[];
    resultModItems: ResultModItem[];
    resultModDisputedCount?: number;
    selectedResultMod: ResultModItem | null;
    selectedResultModReviewState?: DecisionReviewState | null;
    selectedResultModId: string;
    setSelectedResultModId: (itemId: string) => void;
    resultProblems?: ResultProblemItem[];
    resultProblemsSummary?: ResultProblemsSummary | null;
    selectedResultProblem?: ResultProblemItem | null;
    selectedResultProblemId?: string;
    setSelectedResultProblemId?: (itemId: string) => void;
    resultCompareItems?: ResultCompareItem[];
    resultCompareSummary?: ResultCompareSummary | null;
    selectedResultCompareItem?: ResultCompareItem | null;
    selectedResultCompareItemId?: string;
    setSelectedResultCompareItemId?: (itemId: string) => void;
    saveSelectedResultModOverride?: (action: ManualReviewAction) => void;
    confirmSelectedResultModOverride?: () => void;
    clearSelectedResultModOverride?: () => void;
    resultModsDisputedOnly: boolean;
    setResultModsDisputedOnly: (nextValue: boolean) => void;
    resultModsSortMode: ResultModsSortMode;
    setResultModsSortMode: (nextValue: ResultModsSortMode) => void;
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
