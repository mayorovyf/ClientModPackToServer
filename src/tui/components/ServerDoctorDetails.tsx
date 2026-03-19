import React from 'react';
import { Box, Text } from 'ink';

import { useT } from '../i18n/use-t.js';
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

function buildRecommendedActions(doctor: ServerDoctorState, t: ReturnType<typeof useT>): string[] {
    const findings = collectServerDoctorFindings(doctor);
    const actions: string[] = [];

    const addAction = (condition: boolean, message: string): void => {
        if (condition && !actions.includes(message)) {
            actions.push(message);
        }
    };

    addAction(
        findings.some((finding) => finding.code === 'target-dir-required'),
        t('details.serverDoctor.action.targetDir')
    );
    addAction(
        findings.some((finding) => finding.code === 'minecraft-version-required'),
        t('details.serverDoctor.action.minecraftVersion')
    );
    addAction(
        findings.some((finding) => finding.code === 'launcher-missing'),
        t('details.serverDoctor.action.launcher')
    );
    addAction(
        findings.some((finding) => finding.code === 'java-unavailable'),
        t('details.serverDoctor.action.java')
    );
    addAction(
        findings.some((finding) => finding.code === 'eula-pending'),
        t('details.serverDoctor.action.eula')
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
    const t = useT();

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
                <Text color="cyan" wrap="wrap">{t('details.serverDoctor.title')}</Text>
                <Text dimColor wrap="wrap">{t('details.serverDoctor.empty')}</Text>
            </Box>
        );
    }

    const summary = summarizeServerDoctorState(doctorState);
    const topError = pickTopFinding(doctorState, 'error');
    const topWarning = pickTopFinding(doctorState, 'warning');
    const actions = buildRecommendedActions(doctorState, t);

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
                <Text color="cyan" wrap="wrap">{t('details.serverDoctor.title')}</Text>
                <DetailLine
                    label={t('details.serverDoctor.overall')}
                    value={summary.ok ? t('details.serverDoctor.state.ready') : summary.errorCount > 0 ? t('details.serverDoctor.state.blocked') : t('details.serverDoctor.state.warnings')}
                    color={summary.ok ? 'green' : summary.errorCount > 0 ? 'red' : 'yellow'}
                />
                <DetailLine
                    label={t('screen.serverDoctor.install')}
                    value={doctorState.install.ok ? t('details.serverDoctor.state.pass') : t('details.serverDoctor.state.blockedLower')}
                    color={doctorState.install.ok ? 'green' : 'red'}
                />
                <DetailLine
                    label={t('screen.serverDoctor.launch')}
                    value={doctorState.launch.ok ? t('details.serverDoctor.state.pass') : t('details.serverDoctor.state.blockedLower')}
                    color={doctorState.launch.ok ? 'green' : 'red'}
                />
                <DetailLine label={t('details.serverDoctor.errors')} value={String(summary.errorCount)} color={summary.errorCount > 0 ? 'red' : 'green'} />
                <DetailLine label={t('details.serverDoctor.warnings')} value={String(summary.warningCount)} color={summary.warningCount > 0 ? 'yellow' : 'green'} />
                <DetailLine label={t('details.serverDoctor.infos')} value={String(summary.infoCount)} color="cyan" />
                <DetailLine label={t('details.serverDoctor.launcher')} value={doctorState.launch.entrypoint?.kind || t('common.placeholder.na')} />
                <DetailLine label={t('details.serverDoctor.command')} value={doctorState.launch.commandPreview || t('common.placeholder.na')} />
                {topError ? (
                    <Box marginTop={1} flexDirection="column" minWidth={0}>
                        <Text color="red" wrap="wrap">{t('details.serverDoctor.topBlocker')}</Text>
                        <Text wrap="wrap">{`${topError.code}: ${topError.message}`}</Text>
                    </Box>
                ) : topWarning ? (
                    <Box marginTop={1} flexDirection="column" minWidth={0}>
                        <Text color="yellow" wrap="wrap">{t('details.serverDoctor.topWarning')}</Text>
                        <Text wrap="wrap">{`${topWarning.code}: ${topWarning.message}`}</Text>
                    </Box>
                ) : null}
            </Box>

            <Box flexDirection="column" minWidth={0}>
                <Text color="greenBright" wrap="wrap">{t('details.serverDoctor.nextSteps')}</Text>
                {actions.length > 0 ? (
                    actions.map((action) => (
                        <Text key={action} wrap="wrap">{`- ${action}`}</Text>
                    ))
                ) : (
                    <Text wrap="wrap">{t('details.serverDoctor.ready')}</Text>
                )}
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text dimColor wrap="truncate">
                        {t('details.serverDoctor.infoLine', {
                            install: countPreflightFindings(doctorState.install, 'info'),
                            launch: countPreflightFindings(doctorState.launch, 'info')
                        })}
                    </Text>
                </Box>
            </Box>
        </Box>
    );
}
