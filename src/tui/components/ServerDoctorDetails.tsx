import React from 'react';
import { Box, Text } from 'ink';

import {
    collectServerDoctorFindings,
    countPreflightFindings,
    summarizeServerDoctorState
} from '../state/server-doctor.js';

import type { ServerDoctorFinding, ServerDoctorState } from '../state/server-doctor.js';

function DetailLine({
    label,
    value,
    color
}: {
    label: string;
    value: string;
    color?: 'green' | 'yellow' | 'red' | 'cyan';
}): React.JSX.Element {
    return (
        <Box flexDirection="row" minWidth={0}>
            <Box width={10} minWidth={10}>
                <Text dimColor wrap="truncate">{label}</Text>
            </Box>
            <Box flexGrow={1} minWidth={0}>
                {color ? (
                    <Text color={color} wrap="wrap">{value}</Text>
                ) : (
                    <Text wrap="wrap">{value}</Text>
                )}
            </Box>
        </Box>
    );
}

function buildRecommendedActions(doctor: ServerDoctorState): string[] {
    const findings = collectServerDoctorFindings(doctor);
    const actions: string[] = [];

    const addAction = (condition: boolean, message: string): void => {
        if (condition && !actions.includes(message)) {
            actions.push(message);
        }
    };

    addAction(
        findings.some((finding) => finding.code === 'target-dir-required'),
        'Set Target dir before install or launch.'
    );
    addAction(
        findings.some((finding) => finding.code === 'minecraft-version-required'),
        'Specify Minecraft version before installing the selected core.'
    );
    addAction(
        findings.some((finding) => finding.code === 'launcher-missing'),
        'Install a core first or point Explicit launcher to an existing server start file.'
    );
    addAction(
        findings.some((finding) => finding.code === 'java-unavailable'),
        'Fix Java path or ensure java is available in PATH for installer and jar launchers.'
    );
    addAction(
        findings.some((finding) => finding.code === 'eula-pending'),
        'Enable Accept EULA or write eula=true manually before the first launch.'
    );

    return actions.slice(0, 4);
}

function pickTopFinding(doctor: ServerDoctorState, level: ServerDoctorFinding['level']): ServerDoctorFinding | null {
    return collectServerDoctorFindings(doctor).find((finding) => finding.level === level) ?? null;
}

export function ServerDoctorDetails({
    doctorState,
    height
}: {
    doctorState: ServerDoctorState | null;
    height: number;
}): React.JSX.Element {
    if (!doctorState) {
        return (
            <Box
                flexDirection="column"
                justifyContent="center"
                width="100%"
                height={height}
                borderStyle="round"
                borderColor="cyan"
                paddingX={1}
                paddingY={1}
                minWidth={0}
            >
                <Text color="cyan" wrap="wrap">Doctor Summary</Text>
                <Text dimColor wrap="wrap">Open Server / Doctor to inspect install and launch readiness.</Text>
            </Box>
        );
    }

    const summary = summarizeServerDoctorState(doctorState);
    const topError = pickTopFinding(doctorState, 'error');
    const topWarning = pickTopFinding(doctorState, 'warning');
    const actions = buildRecommendedActions(doctorState);

    return (
        <Box
            flexDirection="column"
            justifyContent="space-between"
            width="100%"
            height={height}
            borderStyle="round"
            borderColor="cyan"
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">Doctor Summary</Text>
                <DetailLine
                    label="Overall"
                    value={summary.ok ? 'READY' : summary.errorCount > 0 ? 'BLOCKED' : 'WARNINGS'}
                    color={summary.ok ? 'green' : summary.errorCount > 0 ? 'red' : 'yellow'}
                />
                <DetailLine
                    label="Install"
                    value={doctorState.install.ok ? 'pass' : 'blocked'}
                    color={doctorState.install.ok ? 'green' : 'red'}
                />
                <DetailLine
                    label="Launch"
                    value={doctorState.launch.ok ? 'pass' : 'blocked'}
                    color={doctorState.launch.ok ? 'green' : 'red'}
                />
                <DetailLine label="Errors" value={String(summary.errorCount)} color={summary.errorCount > 0 ? 'red' : 'green'} />
                <DetailLine label="Warnings" value={String(summary.warningCount)} color={summary.warningCount > 0 ? 'yellow' : 'green'} />
                <DetailLine label="Infos" value={String(summary.infoCount)} color="cyan" />
                <DetailLine label="Launcher" value={doctorState.launch.entrypoint?.kind || 'n/a'} />
                <DetailLine label="Command" value={doctorState.launch.commandPreview || 'n/a'} />
                {topError ? (
                    <Box marginTop={1} flexDirection="column" minWidth={0}>
                        <Text color="red" wrap="wrap">Top blocker</Text>
                        <Text wrap="wrap">{`${topError.code}: ${topError.message}`}</Text>
                    </Box>
                ) : topWarning ? (
                    <Box marginTop={1} flexDirection="column" minWidth={0}>
                        <Text color="yellow" wrap="wrap">Top warning</Text>
                        <Text wrap="wrap">{`${topWarning.code}: ${topWarning.message}`}</Text>
                    </Box>
                ) : null}
            </Box>

            <Box flexDirection="column" minWidth={0}>
                <Text color="greenBright" wrap="wrap">Recommended next steps</Text>
                {actions.length > 0 ? (
                    actions.map((action) => (
                        <Text key={action} wrap="wrap">{`- ${action}`}</Text>
                    ))
                ) : (
                    <Text wrap="wrap">No blocking action is required. Server setup looks ready.</Text>
                )}
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text dimColor wrap="truncate">
                        {`Install info: ${countPreflightFindings(doctorState.install, 'info')} | Launch info: ${countPreflightFindings(doctorState.launch, 'info')}`}
                    </Text>
                </Box>
            </Box>
        </Box>
    );
}
