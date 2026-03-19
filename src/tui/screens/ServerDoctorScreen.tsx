import React from 'react';
import { Box, Text } from 'ink';
import { StatusMessage } from '@inkjs/ui';

import { useT } from '../i18n/use-t.js';
import { useScrollOffset } from '../hooks/use-scroll-offset.js';
import {
    collectServerDoctorFindings,
    countPreflightFindings,
    summarizeServerDoctorState
} from '../state/server-doctor.js';

import type { ServerDoctorFinding, ServerDoctorState } from '../state/server-doctor.js';

function getStatusVariant(doctor: ServerDoctorState): 'success' | 'error' | 'warning' {
    const summary = summarizeServerDoctorState(doctor);

    if (summary.errorCount > 0) {
        return 'error';
    }

    if (summary.warningCount > 0) {
        return 'warning';
    }

    return 'success';
}

function getFindingColor(finding: ServerDoctorFinding): 'red' | 'yellow' | 'cyan' {
    switch (finding.level) {
        case 'error':
            return 'red';
        case 'warning':
            return 'yellow';
        case 'info':
        default:
            return 'cyan';
    }
}

function ResultSummary({
    label,
    ok,
    errorCount,
    warningCount,
    infoCount
}: {
    label: string;
    ok: boolean;
    errorCount: number;
    warningCount: number;
    infoCount: number;
}): React.JSX.Element {
    const t = useT();

    return (
        <Box flexDirection="column" minWidth={0}>
            <Text color={ok ? 'greenBright' : 'redBright'} wrap="truncate">
                {`${label}: ${ok ? t('screen.serverDoctor.pass') : t('screen.serverDoctor.blocked')}`}
            </Text>
            <Text dimColor wrap="truncate">
                {t('screen.serverDoctor.counts', {
                    errors: errorCount,
                    warnings: warningCount,
                    infos: infoCount
                })}
            </Text>
        </Box>
    );
}

export function ServerDoctorScreen({
    doctorState,
    isFocused,
    height
}: {
    doctorState: ServerDoctorState | null;
    isFocused: boolean;
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
                borderColor={isFocused ? 'green' : 'cyan'}
                paddingX={1}
                paddingY={1}
                minWidth={0}
            >
                <Text color="cyanBright" wrap="wrap">{t('screen.serverDoctor.title')}</Text>
                <Text dimColor wrap="wrap">{t('screen.serverDoctor.empty')}</Text>
            </Box>
        );
    }

    const summary = summarizeServerDoctorState(doctorState);
    const findings = collectServerDoctorFindings(doctorState);
    const headerLines = 11;
    const visibleFindingCount = Math.max(2, height - headerLines);
    const { offset, hasOverflow } = useScrollOffset({
        itemCount: findings.length,
        viewportSize: visibleFindingCount,
        enabled: isFocused
    });
    const visibleFindings = findings.slice(offset, offset + visibleFindingCount);

    return (
        <Box
            flexDirection="column"
            justifyContent="space-between"
            width="100%"
            height={height}
            borderStyle="round"
            borderColor={isFocused ? 'green' : 'cyan'}
            paddingX={1}
            paddingY={1}
            minWidth={0}
        >
            <Box flexDirection="column" minWidth={0}>
                <Text color="cyanBright" wrap="wrap">{t('screen.serverDoctor.title')}</Text>
                <Box marginTop={1} minWidth={0}>
                    <StatusMessage variant={getStatusVariant(doctorState)}>
                        {summary.ok
                            ? t('section.server.doctor.ok')
                            : summary.errorCount > 0
                                ? t('section.server.doctor.blocking', { count: summary.errorCount })
                                : t('section.server.doctor.warnings', { count: summary.warningCount })}
                    </StatusMessage>
                </Box>
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <ResultSummary
                        label={t('screen.serverDoctor.install')}
                        ok={doctorState.install.ok}
                        errorCount={countPreflightFindings(doctorState.install, 'error')}
                        warningCount={countPreflightFindings(doctorState.install, 'warning')}
                        infoCount={countPreflightFindings(doctorState.install, 'info')}
                    />
                    <ResultSummary
                        label={t('screen.serverDoctor.launch')}
                        ok={doctorState.launch.ok}
                        errorCount={countPreflightFindings(doctorState.launch, 'error')}
                        warningCount={countPreflightFindings(doctorState.launch, 'warning')}
                        infoCount={countPreflightFindings(doctorState.launch, 'info')}
                    />
                </Box>
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text wrap="truncate">{`${t('screen.serverDoctor.target')}: ${doctorState.launch.targetDir || doctorState.install.targetDir || t('screen.serverDoctor.missingTarget')}`}</Text>
                    <Text wrap="truncate">{`${t('screen.serverDoctor.launcher')}: ${doctorState.launch.entrypoint?.path || t('screen.serverDoctor.notResolved')}`}</Text>
                    <Text wrap="truncate">{`${t('screen.serverDoctor.command')}: ${doctorState.launch.commandPreview || t('screen.serverDoctor.notAvailable')}`}</Text>
                </Box>
            </Box>

            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">{t('screen.serverDoctor.findings')}</Text>
                {hasOverflow ? (
                    <Text dimColor wrap="truncate">
                        {t('screen.serverDoctor.scroll', {
                            start: offset + 1,
                            end: Math.min(offset + visibleFindings.length, findings.length),
                            total: findings.length
                        })}
                    </Text>
                ) : null}
                {visibleFindings.length > 0 ? (
                    visibleFindings.map((finding, index) => (
                        <Text
                            key={`${finding.mode}-${finding.code}-${offset + index}`}
                            color={getFindingColor(finding)}
                            wrap="wrap"
                        >
                            {`[${finding.mode}] ${finding.code}: ${finding.message}`}
                        </Text>
                    ))
                ) : (
                    <Text dimColor wrap="wrap">{t('screen.serverDoctor.noFindings')}</Text>
                )}
            </Box>
        </Box>
    );
}
