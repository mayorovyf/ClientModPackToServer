import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp } from 'ink';

import manualReviewOverridesApi from '../review/manual-overrides.js';
import type { ManualReviewAction } from '../review/manual-overrides.js';
import { AuthorsDetails } from './components/AuthorsDetails.js';
import { Layout } from './components/Layout.js';
import { ReportsDetails } from './components/ReportsDetails.js';
import { ReviewDetails } from './components/ReviewDetails.js';
import { RunFieldDetails } from './components/RunFieldDetails.js';
import { RunSummary } from './components/RunSummary.js';
import { SettingsDetails } from './components/SettingsDetails.js';
import { Sidebar } from './components/Sidebar.js';
import { StatusBar } from './components/StatusBar.js';
import { useBackendRun } from './hooks/use-backend-run.js';
import { getColumnOrder, useHotkeys } from './hooks/use-hotkeys.js';
import { useTerminalLayout } from './hooks/use-terminal-layout.js';
import { AuthorsScreen } from './screens/AuthorsScreen.js';
import { BuildScreen } from './screens/BuildScreen.js';
import { RegistryScreen } from './screens/RegistryScreen.js';
import { ReportsScreen } from './screens/ReportsScreen.js';
import { ReviewScreen } from './screens/ReviewScreen.js';
import { SettingsScreen } from './screens/SettingsScreen.js';
import { NAVIGATION_ITEMS } from './state/app-state.js';
import { AUTHOR_PROFILES } from './state/authors.js';
import { loadPersistedTuiState, savePersistedTuiState } from './state/persisted-state.js';
import { loadReportHistory, resolveReportRootDir } from './state/report-history.js';
import { buildReviewItems } from './state/review-items.js';
import type { FocusedColumn, RunFormState, ScreenId, TuiMode } from './state/app-state.js';
import type { ReportHistoryState } from './state/report-history.js';
import type { RunFieldKey } from './state/run-fields.js';
import type { SettingsFieldKey } from './state/settings-fields.js';

const {
    loadManualReviewOverrides,
    removeManualReviewOverride,
    resolveReviewOverridesPath,
    setManualReviewOverride
} = manualReviewOverridesApi;

function renderScreen({
    activeScreen,
    form,
    uiMode,
    session,
    compact,
    eventLimit,
    height,
    setForm,
    startRun,
    setInteractionLocked,
    focusedColumn,
    setSelectedRunField,
    selectedAuthorId,
    setSelectedAuthorId,
    reportHistory,
    selectedReportRunId,
    setSelectedReportRunId,
    reviewItems,
    selectedReviewItemId,
    setSelectedReviewItemId,
    saveReviewOverride,
    clearReviewOverride,
    showHints,
    setShowHints,
    setSelectedSettingsField,
    setUiMode
}: {
    activeScreen: ScreenId;
    form: RunFormState;
    uiMode: TuiMode;
    session: ReturnType<typeof useBackendRun>['session'];
    compact: boolean;
    eventLimit: number;
    height: number;
    setForm: (nextForm: RunFormState) => void;
    startRun: () => void;
    setInteractionLocked: (locked: boolean) => void;
    focusedColumn: FocusedColumn;
    setSelectedRunField: (fieldKey: RunFieldKey) => void;
    selectedAuthorId: string;
    setSelectedAuthorId: (authorId: string) => void;
    reportHistory: ReportHistoryState;
    selectedReportRunId: string;
    setSelectedReportRunId: (runId: string) => void;
    reviewItems: ReturnType<typeof buildReviewItems>;
    selectedReviewItemId: string;
    setSelectedReviewItemId: (itemId: string) => void;
    saveReviewOverride: (action: ManualReviewAction) => void;
    clearReviewOverride: () => void;
    showHints: boolean;
    setShowHints: (nextValue: boolean) => void;
    setSelectedSettingsField: (fieldKey: SettingsFieldKey) => void;
    setUiMode: (nextMode: TuiMode) => void;
}): React.JSX.Element {
    switch (activeScreen) {
        case 'registry':
            return (
                <RegistryScreen
                    form={form}
                    session={session}
                    compact={compact}
                    isFocused={focusedColumn === 'content'}
                    height={height}
                />
            );
        case 'reports':
            return (
                <ReportsScreen
                    entries={reportHistory.entries}
                    reportRootDir={reportHistory.reportRootDir}
                    loadError={reportHistory.error}
                    selectedRunId={selectedReportRunId}
                    onSelectedRunIdChange={setSelectedReportRunId}
                    isFocused={focusedColumn === 'content'}
                    height={height}
                />
            );
        case 'review':
            return (
                <ReviewScreen
                    items={reviewItems}
                    selectedItemId={selectedReviewItemId}
                    onSelectedItemChange={setSelectedReviewItemId}
                    onSaveOverride={saveReviewOverride}
                    onClearOverride={clearReviewOverride}
                    isFocused={focusedColumn === 'content'}
                    height={height}
                />
            );
        case 'settings':
            return (
                <SettingsScreen
                    form={form}
                    uiMode={uiMode}
                    showHints={showHints}
                    onChange={setForm}
                    onUiModeChange={setUiMode}
                    onShowHintsChange={setShowHints}
                    onInteractionChange={setInteractionLocked}
                    onSelectedFieldChange={setSelectedSettingsField}
                    isFocused={focusedColumn === 'content'}
                    height={height}
                />
            );
        case 'authors':
            return (
                <AuthorsScreen
                    selectedAuthorId={selectedAuthorId}
                    onSelectedAuthorChange={setSelectedAuthorId}
                    isFocused={focusedColumn === 'content'}
                    height={height}
                />
            );
        case 'build':
        default:
            return (
                <BuildScreen
                    form={form}
                    uiMode={uiMode}
                    session={session}
                    onChange={setForm}
                    onRun={startRun}
                    onInteractionChange={setInteractionLocked}
                    onSelectedFieldChange={setSelectedRunField}
                    isFocused={focusedColumn === 'content'}
                    compact={compact}
                    height={height}
                />
            );
    }
}

export function App(): React.JSX.Element {
    const { exit } = useApp();
    const layout = useTerminalLayout();
    const [persistedState] = useState(loadPersistedTuiState);
    const [activeScreen, setActiveScreen] = useState<ScreenId>(persistedState.activeScreen);
    const [uiMode, setUiMode] = useState<TuiMode>(persistedState.uiMode);
    const [form, setForm] = useState<RunFormState>(persistedState.form);
    const [focusedColumn, setFocusedColumn] = useState<FocusedColumn>('content');
    const [interactionLocked, setInteractionLocked] = useState(false);
    const [selectedRunField, setSelectedRunField] = useState<RunFieldKey>('inputPath');
    const [selectedAuthorId, setSelectedAuthorId] = useState<string>(AUTHOR_PROFILES[0]?.id ?? '');
    const [selectedReportRunId, setSelectedReportRunId] = useState('');
    const [selectedReviewItemId, setSelectedReviewItemId] = useState('');
    const [selectedSettingsField, setSelectedSettingsField] = useState<SettingsFieldKey>('uiMode');
    const [showHints, setShowHints] = useState(persistedState.showHints);
    const [reviewOverridesRevision, setReviewOverridesRevision] = useState(0);
    const [reviewNotice, setReviewNotice] = useState<{
        level: 'success' | 'error';
        message: string;
    } | null>(null);
    const [persistenceError, setPersistenceError] = useState<string | null>(null);
    const { session, startRun, cancelRun } = useBackendRun();
    const activeScreenLabel = NAVIGATION_ITEMS.find((item) => item.id === activeScreen)?.label || activeScreen;
    const reportRootDir = useMemo(
        () => resolveReportRootDir(form.reportDir, session.reportPaths.reportDir),
        [form.reportDir, session.reportPaths.reportDir]
    );
    const reportHistory = useMemo(
        () => loadReportHistory(reportRootDir),
        [reportRootDir, session.reportPaths.jsonReportPath, session.reportPaths.reportDir, session.status]
    );
    const selectedReportEntry = reportHistory.entries.find((entry) => entry.runId === selectedReportRunId)
        || reportHistory.entries[0]
        || null;
    const reviewOverridesPath = useMemo(
        () => session.lastReport?.run.reviewOverridesPath || resolveReviewOverridesPath(process.cwd()),
        [session.lastReport?.run.reviewOverridesPath]
    );
    const reviewOverrides = useMemo(
        () => loadManualReviewOverrides(reviewOverridesPath),
        [reviewOverridesPath, reviewOverridesRevision]
    );
    const reviewItems = useMemo(
        () => buildReviewItems(session.lastReport, reviewOverrides),
        [session.lastReport, reviewOverrides]
    );
    const selectedReviewItem = reviewItems.find((item) => item.id === selectedReviewItemId)
        || reviewItems[0]
        || null;

    useEffect(() => {
        const allowedColumns = getColumnOrder(activeScreen);

        if (!allowedColumns.includes(focusedColumn)) {
            setFocusedColumn(allowedColumns.includes('content') ? 'content' : (allowedColumns[0] ?? 'content'));
        }
    }, [activeScreen, focusedColumn]);

    useEffect(() => {
        try {
            savePersistedTuiState({
                version: 1,
                activeScreen,
                uiMode,
                showHints,
                form
            });
            setPersistenceError(null);
        } catch (error) {
            setPersistenceError(error instanceof Error ? error.message : String(error));
        }
    }, [activeScreen, form, showHints, uiMode]);

    useEffect(() => {
        if (!selectedReportRunId && reportHistory.entries[0]?.runId) {
            setSelectedReportRunId(reportHistory.entries[0].runId);
            return;
        }

        if (selectedReportRunId && !reportHistory.entries.some((entry) => entry.runId === selectedReportRunId)) {
            setSelectedReportRunId(reportHistory.entries[0]?.runId ?? '');
        }
    }, [reportHistory.entries, selectedReportRunId]);

    useEffect(() => {
        if (!selectedReviewItemId && reviewItems[0]?.id) {
            setSelectedReviewItemId(reviewItems[0].id);
            return;
        }

        if (selectedReviewItemId && !reviewItems.some((item) => item.id === selectedReviewItemId)) {
            setSelectedReviewItemId(reviewItems[0]?.id ?? '');
        }
    }, [reviewItems, selectedReviewItemId]);

    function saveReviewOverride(action: ManualReviewAction): void {
        if (!selectedReviewItem) {
            return;
        }

        try {
            setManualReviewOverride({
                overridesPath: reviewOverridesPath,
                subject: selectedReviewItem.subject,
                action,
                reason: 'Saved from TUI review menu'
            });
            setReviewOverridesRevision((current) => current + 1);
            setReviewNotice({
                level: 'success',
                message: `Сохранено: ${selectedReviewItem.decision.fileName} -> ${action}`
            });
        } catch (error) {
            setReviewNotice({
                level: 'error',
                message: error instanceof Error ? error.message : String(error)
            });
        }
    }

    function clearReviewOverride(): void {
        if (!selectedReviewItem) {
            return;
        }

        try {
            removeManualReviewOverride({
                overridesPath: reviewOverridesPath,
                subject: selectedReviewItem.subject
            });
            setReviewOverridesRevision((current) => current + 1);
            setReviewNotice({
                level: 'success',
                message: `Удалено ручное решение для ${selectedReviewItem.decision.fileName}`
            });
        } catch (error) {
            setReviewNotice({
                level: 'error',
                message: error instanceof Error ? error.message : String(error)
            });
        }
    }

    useHotkeys({
        activeScreen,
        setActiveScreen,
        focusedColumn,
        setFocusedColumn,
        uiMode,
        setUiMode: (nextMode) => setUiMode(nextMode),
        allowGlobalHotkeys: !interactionLocked,
        isRunning: session.status === 'running',
        onRun: () => {
            if (form.inputPath.trim()) {
                void startRun(form);
            }
        },
        onExit: () => {
            cancelRun();
            exit();
        }
    });

    const statusMessage = reviewNotice?.message
        || persistenceError
        || (activeScreen === 'review'
            ? reviewItems.length > 0
                ? 'K keep, X exclude, C снять override'
                : 'После нового запуска здесь появятся спорные моды'
            : session.lastError
                ? session.lastError
                : session.status === 'running'
                    ? 'Pipeline выполняется'
                    : form.inputPath.trim()
                        ? 'Готово к запуску'
                        : 'Сначала укажите папку инстанса');

    if (!layout.sizeSupported) {
        const warnings: string[] = [];

        if (!layout.widthSupported) {
            warnings.push(`Увеличьте ширину окна минимум до ${layout.minimumThreeColumnWidth} символов.`);
        }

        if (!layout.heightSupported) {
            warnings.push(`Увеличьте высоту окна минимум до ${layout.minimumRootHeight} строк.`);
        }

        return (
            <Box
                flexDirection="column"
                width={layout.columns}
                height={layout.rootHeight}
                paddingX={layout.padding}
                paddingY={layout.padding}
            >
                <Box
                    flexDirection="column"
                    justifyContent="center"
                    width={layout.columns}
                    height={layout.rootHeight}
                    borderStyle="round"
                    borderColor="yellow"
                    paddingX={1}
                    minWidth={0}
                >
                    <Text color="yellowBright" wrap="wrap">Окно слишком маленькое</Text>
                    {warnings.map((warning) => (
                        <Text key={warning} wrap="wrap">{warning}</Text>
                    ))}
                    <Text dimColor wrap="wrap">{`Сейчас: ${layout.columns} x ${layout.rows}`}</Text>
                </Box>
            </Box>
        );
    }

    const sidebarHeight = layout.sidebarInline ? layout.mainAreaHeight : layout.sidebarHeight;
    const screenHeight = layout.sidebarInline ? layout.mainAreaHeight : layout.screenAreaHeight;
    const detailsHeight = layout.detailsInline ? layout.mainAreaHeight : layout.detailsHeight;

    return (
        <Layout
            layout={layout}
            sidebar={
                <Sidebar
                    items={NAVIGATION_ITEMS}
                    activeScreen={activeScreen}
                    isFocused={focusedColumn === 'sidebar'}
                    uiMode={uiMode}
                    runStatus={session.status}
                    showHints={showHints}
                    compact={layout.compact}
                    height={sidebarHeight}
                    {...(layout.sidebarInline ? { width: layout.sidebarWidth } : {})}
                />
            }
            content={
                <Box flexDirection="column" width="100%" height={screenHeight} flexGrow={1} minWidth={0}>
                    {renderScreen({
                        activeScreen,
                        form,
                        uiMode,
                        session,
                        compact: layout.compact,
                        eventLimit: layout.eventLimit,
                        height: screenHeight,
                        setForm,
                        startRun: () => {
                            if (form.inputPath.trim()) {
                                void startRun(form);
                            }
                        },
                        setInteractionLocked,
                        focusedColumn,
                        setSelectedRunField,
                        selectedAuthorId,
                        setSelectedAuthorId,
                        reportHistory,
                        selectedReportRunId,
                        setSelectedReportRunId,
                        reviewItems,
                        selectedReviewItemId,
                        setSelectedReviewItemId,
                        saveReviewOverride,
                        clearReviewOverride,
                        showHints,
                        setShowHints,
                        setSelectedSettingsField,
                        setUiMode
                    })}
                </Box>
            }
            details={
                activeScreen === 'build' ? (
                    <RunFieldDetails
                        fieldKey={selectedRunField}
                        form={form}
                        uiMode={uiMode}
                        isRunning={session.status === 'running'}
                        isFocused={false}
                        height={detailsHeight}
                    />
                ) : activeScreen === 'authors' ? (
                    <AuthorsDetails
                        selectedAuthorId={selectedAuthorId}
                        isFocused={focusedColumn === 'details'}
                        height={detailsHeight}
                    />
                ) : activeScreen === 'reports' ? (
                    <ReportsDetails
                        entry={selectedReportEntry}
                        reportRootDir={reportHistory.reportRootDir}
                        loadError={reportHistory.error}
                        isFocused={focusedColumn === 'details'}
                        height={detailsHeight}
                    />
                ) : activeScreen === 'review' ? (
                    <ReviewDetails
                        item={selectedReviewItem}
                        overridesPath={reviewOverridesPath}
                        notice={reviewNotice}
                        isFocused={focusedColumn === 'details'}
                        height={detailsHeight}
                    />
                ) : activeScreen === 'settings' ? (
                    <SettingsDetails
                        fieldKey={selectedSettingsField}
                        form={form}
                        uiMode={uiMode}
                        showHints={showHints}
                        height={detailsHeight}
                    />
                ) : (
                    <RunSummary
                        session={session}
                        compact={layout.compact}
                        eventLimit={layout.eventLimit}
                        isFocused={focusedColumn === 'details'}
                        height={detailsHeight}
                    />
                )
            }
            statusBar={
                <StatusBar
                    activeScreenLabel={activeScreenLabel}
                    focusedColumn={focusedColumn}
                    uiMode={uiMode}
                    runStatus={session.status}
                    currentStage={session.currentStage}
                    statusMessage={statusMessage}
                />
            }
        />
    );
}
