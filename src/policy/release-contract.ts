const { resolveTerminalOutcomeContract } = require('../outcome/terminal-outcomes');
const { assessSupportBoundary } = require('./support-boundary');
const { createTrustPolicyContract } = require('./trust-policy');

import type { RunReport } from '../types/report';
import type { RunContext } from '../types/run';

function createPhase0PreflightContract({
    runContext
}: {
    runContext: RunContext;
}) {
    const supportBoundary = assessSupportBoundary({
        runContext,
        isFinal: false
    });

    return {
        supportBoundary,
        trustPolicy: createTrustPolicyContract(),
        terminalOutcomes: resolveTerminalOutcomeContract({
            supportBoundary
        })
    };
}

function createPhase0ReportContract({
    runContext,
    report
}: {
    runContext: RunContext;
    report: RunReport;
}) {
    const supportBoundary = assessSupportBoundary({
        runContext,
        decisions: report.decisions || [],
        runtimeDetection: report.runtimeDetection || null,
        validationEntrypoint: report.validation?.entrypoint || null,
        isFinal: true
    });

    return {
        supportBoundary,
        trustPolicy: createTrustPolicyContract(),
        terminalOutcomes: resolveTerminalOutcomeContract({
            supportBoundary
        })
    };
}

module.exports = {
    createPhase0PreflightContract,
    createPhase0ReportContract
};
