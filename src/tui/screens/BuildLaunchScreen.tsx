import React, { useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';

import type { RunFormState, RunSessionState } from '../state/app-state.js';
import type { RunPreflightSummary } from '../state/run-preflight.js';

type LaunchActionId = 'run-current' | 'run-dry' | 'run-full';

interface LaunchAction {
    id: LaunchActionId;
    label: string;
    summary: string;
    enabled: boolean;
}

function createLaunchActions(form: RunFormState, session: RunSessionState, preflight: RunPreflightSummary): LaunchAction[] {
    const canRun = preflight.canRun && session.status !== 'running';

    return [
        {
            id: 'run-current',
            label: session.status === 'running' ? 'Pipeline is running' : 'Run current plan',
            summary: form.dryRun ? 'Start the current dry-run configuration.' : 'Start the current build configuration.',
            enabled: canRun
        },
        {
            id: 'run-dry',
            label: 'Run dry-run once',
            summary: 'Launch one analyze-only run without changing the saved form.',
            enabled: preflight.canRun && session.status !== 'running'
        },
        {
            id: 'run-full',
            label: 'Run full build once',
            summary: 'Launch one full build without changing the saved form.',
            enabled: preflight.canRun && session.status !== 'running'
        }
    ];
}

function getVisibleWindow(total: number, selectedIndex: number, maxVisible: number): { start: number; end: number } {
    if (maxVisible >= total) {
        return { start: 0, end: total };
    }

    const half = Math.floor(maxVisible / 2);
    let start = Math.max(0, selectedIndex - half);
    let end = start + maxVisible;

    if (end > total) {
        end = total;
        start = Math.max(0, end - maxVisible);
    }

    return { start, end };
}

export function BuildLaunchScreen({
    form,
    session,
    preflight,
    onRunCurrent,
    onRunDryRunOnce,
    onRunFullBuildOnce,
    isFocused,
    height
}: {
    form: RunFormState;
    session: RunSessionState;
    preflight: RunPreflightSummary;
    onRunCurrent: () => void;
    onRunDryRunOnce: () => void;
    onRunFullBuildOnce: () => void;
    isFocused: boolean;
    height: number;
}): React.JSX.Element {
    const actions = createLaunchActions(form, session, preflight);
    const [selectedActionId, setSelectedActionId] = useState<LaunchActionId>('run-current');
    const selectedIndex = Math.max(actions.findIndex((action) => action.id === selectedActionId), 0);

    useInput((_input, key) => {
        if (!isFocused) {
            return;
        }

        if (key.upArrow) {
            const nextIndex = selectedIndex <= 0 ? actions.length - 1 : selectedIndex - 1;
            setSelectedActionId(actions[nextIndex]!.id);
            return;
        }

        if (key.downArrow) {
            const nextIndex = selectedIndex >= actions.length - 1 ? 0 : selectedIndex + 1;
            setSelectedActionId(actions[nextIndex]!.id);
            return;
        }

        if (!key.return) {
            return;
        }

        const selectedAction = actions[selectedIndex];

        if (!selectedAction?.enabled) {
            return;
        }

        switch (selectedAction.id) {
            case 'run-current':
                onRunCurrent();
                return;
            case 'run-dry':
                onRunDryRunOnce();
                return;
            case 'run-full':
                onRunFullBuildOnce();
                return;
            default:
                return;
        }
    });

    const planLines = [
        `Mode: ${form.dryRun ? 'dry-run' : 'build'}`,
        `Profile: ${form.profile}`,
        `Deep-check: ${form.deepCheckMode}`,
        `Validation: ${form.validationMode}`,
        `Registry: ${form.registryMode}`,
        `Output: ${form.outputPath || '<default>'}`,
        `Reports: ${form.reportDir || '<default>'}`
    ];
    const headerLines = 3 + planLines.length;
    const viewportLines = Math.max(2, Math.max(6, height - 4) - headerLines);
    const linesPerAction = 2;
    const visibleActionCount = Math.max(1, Math.floor(viewportLines / linesPerAction));
    const listHeight = visibleActionCount * linesPerAction;
    const windowRange = useMemo(
        () => getVisibleWindow(actions.length, selectedIndex, visibleActionCount),
        [actions.length, selectedIndex, visibleActionCount]
    );
    const visibleActions = actions.slice(windowRange.start, windowRange.end);

    return (
        <Box
            flexDirection="column"
            justifyContent="space-between"
            width="100%"
            height={height}
            borderStyle="round"
            borderColor={isFocused ? 'green' : 'yellow'}
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Box flexDirection="column" minWidth={0}>
                <Text color="yellowBright">Launch plan</Text>
                <Text dimColor wrap="truncate">{`Preflight: ${preflight.errors} blocker(s), ${preflight.warnings} warning(s)`}</Text>
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    {planLines.map((line) => (
                        <Text key={line} wrap="truncate">{line}</Text>
                    ))}
                </Box>
            </Box>

            <Box marginTop={1} flexDirection="column" height={listHeight} minWidth={0}>
                {visibleActions.map((action, index) => {
                    const actualIndex = windowRange.start + index;
                    const isSelected = actualIndex === selectedIndex;

                    return (
                        <Box key={action.id} flexDirection="column" minWidth={0}>
                            <Box width="100%" minWidth={0}>
                                <Box flexDirection="row" flexGrow={1} minWidth={0}>
                                    <Box width={2} minWidth={2}>
                                        <Text color={isSelected ? 'greenBright' : 'white'}>
                                            {isSelected ? '>' : ' '}
                                        </Text>
                                    </Box>
                                    <Box flexGrow={1} minWidth={0}>
                                        <Text
                                            color={action.enabled ? (isSelected ? 'greenBright' : 'white') : 'gray'}
                                            wrap="truncate"
                                        >
                                            {action.label}
                                        </Text>
                                    </Box>
                                </Box>
                            </Box>
                            <Box paddingLeft={2} minWidth={0}>
                                <Text dimColor wrap="truncate">{action.summary}</Text>
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}
