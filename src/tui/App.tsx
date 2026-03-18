import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp } from 'ink';

import entrypointApi from '../server/entrypoint.js';
import manualReviewOverridesApi from '../review/manual-overrides.js';
import type { ManualReviewAction } from '../review/manual-overrides.js';
import { Layout } from './components/Layout.js';
import { SectionShell } from './components/SectionShell.js';
import { Sidebar } from './components/Sidebar.js';
import { StatusBar } from './components/StatusBar.js';
import { useBackendRun } from './hooks/use-backend-run.js';
import { getColumnOrder, useHotkeys } from './hooks/use-hotkeys.js';
import { useServerManager } from './hooks/use-server-manager.js';
import { useTerminalLayout } from './hooks/use-terminal-layout.js';
import { createSectionRegistry } from './sections/registry.js';
import { NAVIGATION_ITEMS } from './state/app-state.js';
import { AUTHOR_PROFILES } from './state/authors.js';
import { loadPersistedTuiState, savePersistedTuiState } from './state/persisted-state.js';
import { deleteRunPreset, loadRunPresets, saveRunPreset } from './state/presets.js';
import { loadReportHistory, resolveReportRootDir } from './state/report-history.js';
import { buildReviewItems } from './state/review-items.js';
import { buildServerDoctorState } from './state/server-doctor.js';

import type { ActivePageByScreen, FocusedColumn, RunFormState, ScreenId, ServerFormState, TuiMode } from './state/app-state.js';
import type { ReportHistoryState } from './state/report-history.js';
import type { RunPreset } from './state/presets.js';
import type { RunFieldKey } from './state/run-fields.js';
import type { ServerFieldKey } from './state/server-fields.js';
import type { SettingsFieldKey } from './state/settings-fields.js';
import type { SectionRegistryContext } from './sections/types.js';

const {
    loadManualReviewOverrides,
    removeManualReviewOverride,
    resolveReviewOverridesPath,
    setManualReviewOverride
} = manualReviewOverridesApi;
const { resolveManagedServerEntrypoint } = entrypointApi;

interface NoticeState {
    level: 'success' | 'error';
    message: string;
}

function getLatestBuildDir(reportHistory: ReportHistoryState): string | null {
    return reportHistory.entries.find((entry) => typeof entry.buildDir === 'string' && entry.buildDir.trim())?.buildDir ?? null;
}

export function App(): React.JSX.Element {
    const { exit } = useApp();
    const layout = useTerminalLayout();
    const [persistedState] = useState(loadPersistedTuiState);
    const [activeScreen, setActiveScreen] = useState<ScreenId>(persistedState.activeScreen);
    const [activePageByScreen, setActivePageByScreen] = useState<ActivePageByScreen>(persistedState.activePageByScreen);
    const [uiMode, setUiMode] = useState<TuiMode>(persistedState.uiMode);
    const [form, setForm] = useState<RunFormState>(persistedState.form);
    const [serverForm, setServerForm] = useState<ServerFormState>(persistedState.serverForm);
    const [focusedColumn, setFocusedColumn] = useState<FocusedColumn>('content');
    const [interactionLocked, setInteractionLocked] = useState(false);
    const [selectedRunField, setSelectedRunField] = useState<RunFieldKey>('inputPath');
    const [selectedServerField, setSelectedServerField] = useState<ServerFieldKey>('targetDir');
    const [selectedAuthorId, setSelectedAuthorId] = useState<string>(AUTHOR_PROFILES[0]?.id ?? '');
    const [selectedReportRunId, setSelectedReportRunId] = useState('');
    const [selectedReviewItemId, setSelectedReviewItemId] = useState('');
    const [selectedSettingsField, setSelectedSettingsField] = useState<SettingsFieldKey>('uiMode');
    const [selectedPresetId, setSelectedPresetId] = useState('');
    const [showHints, setShowHints] = useState(persistedState.showHints);
    const [reviewOverridesRevision, setReviewOverridesRevision] = useState(0);
    const [presetRevision, setPresetRevision] = useState(0);
    const [reviewNotice, setReviewNotice] = useState<NoticeState | null>(null);
    const [appNotice, setAppNotice] = useState<NoticeState | null>(null);
    const [persistenceError, setPersistenceError] = useState<string | null>(null);
    const { session, startRun, cancelRun } = useBackendRun();
    const serverManager = useServerManager();

    const reportRootDir = useMemo(
        () => resolveReportRootDir(form.reportDir, session.reportPaths.reportDir),
        [form.reportDir, session.reportPaths.reportDir]
    );
    const reportHistory = useMemo(
        () => loadReportHistory(reportRootDir),
        [reportRootDir, session.reportPaths.jsonReportPath, session.reportPaths.reportDir, session.status]
    );
    const presets = useMemo(
        () => loadRunPresets(),
        [presetRevision]
    );
    const selectedPreset: RunPreset | null = useMemo(
        () => presets.find((preset) => preset.id === selectedPresetId) ?? presets[0] ?? null,
        [presets, selectedPresetId]
    );
    const selectedReportEntry = reportHistory.entries.find((entry) => entry.runId === selectedReportRunId)
        || reportHistory.entries[0]
        || null;
    const latestBuildDir = useMemo(
        () => session.lastReport?.run.buildDir || getLatestBuildDir(reportHistory),
        [reportHistory, session.lastReport]
    );
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
    const serverDoctor = useMemo(() => {
        if (activeScreen !== 'server' || activePageByScreen.server !== 'doctor') {
            return null;
        }

        return buildServerDoctorState(serverForm);
    }, [
        activeScreen,
        activePageByScreen.server,
        serverForm,
        serverManager.state.installStatus,
        serverManager.state.launchStatus,
        serverManager.state.lastInstall?.installedAt,
        serverManager.state.resolvedEntrypointPath
    ]);
    const sectionContext: SectionRegistryContext = {
        form,
        setForm,
        uiMode,
        setUiMode,
        showHints,
        setShowHints,
        session,
        compact: layout.compact,
        latestBuildDir,
        selectedRunField,
        setSelectedRunField,
        serverForm,
        setServerForm,
        serverState: serverManager.state,
        serverDoctor,
        installServerCore: () => {
            setAppNotice(null);
            void serverManager.installCore(serverForm);
        },
        useLatestBuildForServer: useLatestBuildForServer,
        applyServerEntrypointToValidation,
        launchServer: () => {
            setAppNotice(null);
            void serverManager.launchServer(serverForm);
        },
        stopServer: serverManager.stopServer,
        clearServerLogs: serverManager.clearLogs,
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
        onInteractionChange: setInteractionLocked,
        onRun: handleRun
    };
    const sectionRegistry = createSectionRegistry(sectionContext);
    const activeSection = sectionRegistry[activeScreen];
    const activePageId = activePageByScreen[activeScreen];
    const activePage = activeSection.pages.find((page) => page.id === activePageId) ?? activeSection.pages[0]!;
    const activePageIds = activeSection.pages.map((page) => page.id);
    const activeScreenLabel = activeSection?.label || NAVIGATION_ITEMS.find((item) => item.id === activeScreen)?.label || activeScreen;
    const activePageLabel = activePage?.label || String(activePageId || '');
    const showDetails = Boolean(activePage?.hasDetails && activePage.renderDetails);

    useEffect(() => {
        const allowedColumns = getColumnOrder(showDetails);

        if (!allowedColumns.includes(focusedColumn)) {
            setFocusedColumn(allowedColumns.includes('content') ? 'content' : (allowedColumns[0] ?? 'content'));
        }
    }, [focusedColumn, showDetails]);

    useEffect(() => {
        if (!activePage || activePage.id === activePageId) {
            return;
        }

        setActivePageByScreen((current) => ({
            ...current,
            [activeScreen]: activeSection.defaultPage
        }));
    }, [activePage, activePageId, activeScreen, activeSection.defaultPage]);

    useEffect(() => {
        try {
            savePersistedTuiState({
                version: 2,
                activeScreen,
                activePageByScreen,
                uiMode,
                showHints,
                form,
                serverForm
            });
            setPersistenceError(null);
        } catch (error) {
            setPersistenceError(error instanceof Error ? error.message : String(error));
        }
    }, [activePageByScreen, activeScreen, form, serverForm, showHints, uiMode]);

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

    useEffect(() => {
        if (presets.length === 0) {
            if (selectedPresetId) {
                setSelectedPresetId('');
            }
            return;
        }

        if (!selectedPresetId || !presets.some((preset) => preset.id === selectedPresetId)) {
            setSelectedPresetId(presets[0]?.id ?? '');
        }
    }, [presets, selectedPresetId]);

    useEffect(() => {
        const targetDir = serverForm.targetDir.trim();
        const explicitEntrypointPath = serverForm.explicitEntrypointPath.trim();

        if (!targetDir && !explicitEntrypointPath) {
            serverManager.setResolvedEntrypointPath(null);
            return;
        }

        try {
            const entrypoint = resolveManagedServerEntrypoint({
                serverDir: targetDir,
                explicitEntrypointPath: explicitEntrypointPath || null
            });

            serverManager.setResolvedEntrypointPath(entrypoint?.path ?? null);
        } catch {
            serverManager.setResolvedEntrypointPath(null);
        }
        // The setter comes from a local hook and is intentionally treated as stable here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverForm.explicitEntrypointPath, serverForm.targetDir]);

    function handleRun(): void {
        if (!form.inputPath.trim()) {
            setAppNotice({
                level: 'error',
                message: 'Input instance path is required before running the pipeline'
            });
            return;
        }

        setAppNotice(null);
        void startRun(form);
    }

    function refreshPresets(nextSelectedPresetId?: string): void {
        setPresetRevision((current) => current + 1);

        if (typeof nextSelectedPresetId === 'string') {
            setSelectedPresetId(nextSelectedPresetId);
        }
    }

    function setActivePage<S extends ScreenId>(screenId: S, pageId: ActivePageByScreen[S]): void {
        setActivePageByScreen((current) => ({
            ...current,
            [screenId]: pageId
        }));
    }

    function applySelectedPreset(): void {
        if (!selectedPreset) {
            return;
        }

        setForm(selectedPreset.form);
        setActiveScreen('build');
        setActivePage('build', 'inputs');
        setFocusedColumn('content');
        setAppNotice({
            level: 'success',
            message: `Preset applied: ${selectedPreset.name}`
        });
    }

    function createPreset(name: string): void {
        try {
            const preset = saveRunPreset({
                name,
                form
            });

            refreshPresets(preset.id);
            setAppNotice({
                level: 'success',
                message: `Preset saved: ${preset.name}`
            });
        } catch (error) {
            setAppNotice({
                level: 'error',
                message: error instanceof Error ? error.message : String(error)
            });
        }
    }

    function updateSelectedPreset(): void {
        if (!selectedPreset) {
            return;
        }

        try {
            const preset = saveRunPreset({
                id: selectedPreset.id,
                name: selectedPreset.name,
                form
            });

            refreshPresets(preset.id);
            setAppNotice({
                level: 'success',
                message: `Preset updated: ${preset.name}`
            });
        } catch (error) {
            setAppNotice({
                level: 'error',
                message: error instanceof Error ? error.message : String(error)
            });
        }
    }

    function deleteSelectedPreset(): void {
        if (!selectedPreset) {
            return;
        }

        const deleted = deleteRunPreset(selectedPreset.id);

        if (!deleted) {
            setAppNotice({
                level: 'error',
                message: `Preset was not found: ${selectedPreset.name}`
            });
            return;
        }

        refreshPresets();
        setAppNotice({
            level: 'success',
            message: `Preset deleted: ${selectedPreset.name}`
        });
    }

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
                message: `Saved manual decision: ${selectedReviewItem.decision.fileName} -> ${action}`
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
                message: `Cleared manual decision for ${selectedReviewItem.decision.fileName}`
            });
        } catch (error) {
            setReviewNotice({
                level: 'error',
                message: error instanceof Error ? error.message : String(error)
            });
        }
    }

    function useLatestBuildForServer(): void {
        if (!latestBuildDir) {
            setAppNotice({
                level: 'error',
                message: 'No built server directory is available yet'
            });
            return;
        }

        setServerForm((current) => ({
            ...current,
            targetDir: latestBuildDir
        }));
        setAppNotice({
            level: 'success',
            message: `Target server dir set to latest build: ${latestBuildDir}`
        });
    }

    function applyServerEntrypointToValidation(): void {
        const entrypointPath = serverManager.state.resolvedEntrypointPath || serverForm.explicitEntrypointPath.trim();

        if (!entrypointPath) {
            setAppNotice({
                level: 'error',
                message: 'No resolved server launcher is available yet'
            });
            return;
        }

        setForm((current) => ({
            ...current,
            validationEntrypointPath: entrypointPath
        }));
        setAppNotice({
            level: 'success',
            message: 'Validation entrypoint updated from the managed server launcher'
        });
    }

    useHotkeys({
        activeScreen,
        setActiveScreen,
        activePageId: String(activePage?.id || ''),
        activePageIds: activePageIds.map((pageId) => String(pageId)),
        onActivePageChange: (nextPageId) => {
            if (activePageIds.includes(nextPageId as never)) {
                setActivePage(activeScreen, nextPageId as ActivePageByScreen[typeof activeScreen]);
            }
        },
        focusedColumn,
        setFocusedColumn,
        uiMode,
        setUiMode: (nextMode) => setUiMode(nextMode),
        showDetails,
        allowGlobalHotkeys: !interactionLocked,
        isRunning: session.status === 'running',
        onRun: handleRun,
        onExit: () => {
            cancelRun();
            serverManager.stopServer();
            exit();
        }
    });

    const pageStatusMessage = activePage?.getStatusMessage?.() || null;
    const fallbackStatusMessage = serverManager.state.lastError
        || session.lastError
        || (session.status === 'running'
            ? 'Pipeline is running'
            : form.inputPath.trim()
                ? 'Ready to run'
                : 'Set the instance path before starting the pipeline');
    const statusMessage = appNotice?.message
        || reviewNotice?.message
        || persistenceError
        || pageStatusMessage
        || fallbackStatusMessage;

    if (!layout.sizeSupported) {
        const warnings: string[] = [];

        if (!layout.widthSupported) {
            warnings.push(`Increase terminal width to at least ${layout.minimumThreeColumnWidth} characters.`);
        }

        if (!layout.heightSupported) {
            warnings.push(`Increase terminal height to at least ${layout.minimumRootHeight} rows.`);
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
                    <Text color="yellowBright" wrap="wrap">Terminal window is too small</Text>
                    {warnings.map((warning) => (
                        <Text key={warning} wrap="wrap">{warning}</Text>
                    ))}
                    <Text dimColor wrap="wrap">{`Current size: ${layout.columns} x ${layout.rows}`}</Text>
                </Box>
            </Box>
        );
    }

    const sidebarHeight = layout.sidebarInline ? layout.mainAreaHeight : layout.sidebarHeight;
    const screenHeight = layout.sidebarInline ? layout.mainAreaHeight : layout.screenAreaHeight;
    const detailsHeight = layout.detailsInline ? layout.mainAreaHeight : layout.detailsHeight;
    const content = (
        <SectionShell
            section={activeSection}
            activePageId={activePage.id}
            height={screenHeight}
            isFocused={focusedColumn === 'content'}
            content={(contentHeight) => activePage.renderContent({
                contentHeight,
                detailsHeight,
                isContentFocused: focusedColumn === 'content',
                isDetailsFocused: focusedColumn === 'details'
            })}
        />
    );

    const details = showDetails && activePage.renderDetails
        ? activePage.renderDetails({
            contentHeight: screenHeight,
            detailsHeight,
            isContentFocused: focusedColumn === 'content',
            isDetailsFocused: focusedColumn === 'details'
        })
        : undefined;

    return (
        <Layout
            layout={layout}
            sidebar={
                <Sidebar
                    items={NAVIGATION_ITEMS}
                    activeScreen={activeScreen}
                    activePageLabel={activePageLabel}
                    hasMultiplePages={activeSection.pages.length > 1}
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
                    {content}
                </Box>
            }
            showDetails={showDetails}
            details={details}
            statusBar={
                <StatusBar
                    activeScreenLabel={activeScreenLabel}
                    activePageLabel={activePageLabel}
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
