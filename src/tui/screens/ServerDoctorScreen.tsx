import React from 'react';
import { Box, Text } from 'ink';
import { StatusMessage } from '@inkjs/ui';

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
    return (
        <Box flexDirection="column" minWidth={0}>
            <Text color={ok ? 'greenBright' : 'redBright'} wrap="truncate">
                {`${label}: ${ok ? 'PASS' : 'BLOCKED'}`}
            </Text>
            <Text dimColor wrap="truncate">
                {`errors ${errorCount} | warnings ${warningCount} | info ${infoCount}`}
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
                <Text color="cyanBright" wrap="wrap">Server Doctor</Text>
                <Text dimColor wrap="wrap">Open this page inside the Server section to run install and launch preflight checks.</Text>
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
                <Text color="cyanBright" wrap="wrap">Server Doctor</Text>
                <Box marginTop={1} minWidth={0}>
                    <StatusMessage variant={getStatusVariant(doctorState)}>
                        {summary.ok
                            ? 'Install and launch preflight both pass'
                            : summary.errorCount > 0
                                ? `Doctor found ${summary.errorCount} blocking issue(s)`
                                : `Doctor passed with ${summary.warningCount} warning(s)`}
                    </StatusMessage>
                </Box>
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <ResultSummary
                        label="Install"
                        ok={doctorState.install.ok}
                        errorCount={countPreflightFindings(doctorState.install, 'error')}
                        warningCount={countPreflightFindings(doctorState.install, 'warning')}
                        infoCount={countPreflightFindings(doctorState.install, 'info')}
                    />
                    <ResultSummary
                        label="Launch"
                        ok={doctorState.launch.ok}
                        errorCount={countPreflightFindings(doctorState.launch, 'error')}
                        warningCount={countPreflightFindings(doctorState.launch, 'warning')}
                        infoCount={countPreflightFindings(doctorState.launch, 'info')}
                    />
                </Box>
                <Box marginTop={1} flexDirection="column" minWidth={0}>
                    <Text wrap="truncate">{`Target: ${doctorState.launch.targetDir || doctorState.install.targetDir || '<missing>'}`}</Text>
                    <Text wrap="truncate">{`Launcher: ${doctorState.launch.entrypoint?.path || '<not resolved>'}`}</Text>
                    <Text wrap="truncate">{`Command: ${doctorState.launch.commandPreview || '<not available>'}`}</Text>
                </Box>
            </Box>

            <Box flexDirection="column" minWidth={0}>
                <Text color="cyan" wrap="wrap">Findings</Text>
                {hasOverflow ? (
                    <Text dimColor wrap="truncate">
                        {`j/k or ↑/↓ scroll findings | ${offset + 1}-${Math.min(offset + visibleFindings.length, findings.length)} of ${findings.length}`}
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
                    <Text dimColor wrap="wrap">No findings were produced yet.</Text>
                )}
            </Box>
        </Box>
    );
}
