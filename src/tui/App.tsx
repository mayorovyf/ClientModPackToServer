import React, { useState } from 'react';
import { Box, Text, useApp } from 'ink';

import { Layout } from './components/Layout.js';
import { RunSummary } from './components/RunSummary.js';
import { Sidebar } from './components/Sidebar.js';
import { StatusBar } from './components/StatusBar.js';
import { useBackendRun } from './hooks/use-backend-run.js';
import { useHotkeys } from './hooks/use-hotkeys.js';
import { useTerminalLayout } from './hooks/use-terminal-layout.js';
import { BuildScreen } from './screens/BuildScreen.js';
import { RegistryScreen } from './screens/RegistryScreen.js';
import { ReportsScreen } from './screens/ReportsScreen.js';
import { ReviewScreen } from './screens/ReviewScreen.js';
import { SettingsScreen } from './screens/SettingsScreen.js';
import {
    createDefaultRunFormState,
    NAVIGATION_ITEMS
} from './state/app-state.js';
import type { RunFormState, ScreenId, TuiMode } from './state/app-state.js';

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
    setInteractionLocked
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
}): React.JSX.Element {
    switch (activeScreen) {
        case 'registry':
            return <RegistryScreen form={form} session={session} compact={compact} height={height} />;
        case 'reports':
            return <ReportsScreen session={session} compact={compact} eventLimit={eventLimit * 2} height={height} />;
        case 'review':
            return <ReviewScreen session={session} compact={compact} height={height} />;
        case 'settings':
            return <SettingsScreen uiMode={uiMode} cwd={process.cwd()} compact={compact} height={height} />;
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
                    compact={compact}
                    height={height}
                />
            );
    }
}

export function App(): React.JSX.Element {
    const { exit } = useApp();
    const layout = useTerminalLayout();
    const [activeScreen, setActiveScreen] = useState<ScreenId>('build');
    const [uiMode, setUiMode] = useState<TuiMode>('simple');
    const [form, setForm] = useState<RunFormState>(createDefaultRunFormState);
    const [interactionLocked, setInteractionLocked] = useState(false);
    const { session, startRun } = useBackendRun();

    useHotkeys({
        activeScreen,
        setActiveScreen,
        uiMode,
        setUiMode: (nextMode) => setUiMode(nextMode),
        allowGlobalHotkeys: !interactionLocked,
        isRunning: session.status === 'running',
        onRun: () => {
            if (form.inputPath.trim()) {
                void startRun(form);
            }
        },
        onExit: exit
    });

    const statusMessage = session.lastError
        ? session.lastError
        : form.inputPath.trim()
            ? 'Готово к запуску'
            : 'Сначала укажите папку с модами';

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

    return (
        <Layout
            layout={layout}
            sidebar={
                <Sidebar
                    items={NAVIGATION_ITEMS}
                    activeScreen={activeScreen}
                    uiMode={uiMode}
                    runStatus={session.status}
                    compact={layout.compact}
                    height={layout.mainAreaHeight}
                    width={layout.sidebarWidth}
                />
            }
            content={
                <Box flexDirection="column" width="100%" height={layout.mainAreaHeight} flexGrow={1} minWidth={0}>
                    {renderScreen({
                        activeScreen,
                        form,
                        uiMode,
                        session,
                        compact: layout.compact,
                        eventLimit: layout.eventLimit,
                        height: layout.mainAreaHeight,
                        setForm,
                        startRun: () => {
                            if (form.inputPath.trim()) {
                                void startRun(form);
                            }
                        },
                        setInteractionLocked
                    })}
                </Box>
            }
            details={
                <RunSummary
                    session={session}
                    compact={layout.compact}
                    eventLimit={layout.eventLimit}
                    height={layout.mainAreaHeight}
                />
            }
            statusBar={
                <StatusBar
                    activeScreen={activeScreen}
                    uiMode={uiMode}
                    runStatus={session.status}
                    currentStage={session.currentStage}
                    statusMessage={statusMessage}
                />
            }
        />
    );
}
