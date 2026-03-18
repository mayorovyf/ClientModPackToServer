const { VALIDATION_STATUSES } = require('./constants');

function createValidationSummary(report) {
    return {
        totalIssues: report.issues.length,
        suspectedFalseRemovals: report.suspectedFalseRemovals.length,
        successMarkers: report.successMarkers.length,
        failureMarkers: report.failureMarkers.length,
        linkedIssues: report.issues.filter((issue) => Array.isArray(issue.linkedDecisions) && issue.linkedDecisions.length > 0).length
    };
}

function createEmptyValidationReport(mode, {
    status = VALIDATION_STATUSES.notRun,
    skipReason = null,
    errors = [],
    warnings = []
} = {}) {
    const report = {
        status,
        mode,
        runAttempted: false,
        skipReason,
        startedAt: null,
        finishedAt: null,
        durationMs: 0,
        entrypoint: null,
        workingDirectory: null,
        successMarkers: [],
        failureMarkers: [],
        issues: [],
        suspectedFalseRemovals: [],
        logArtifacts: {},
        warnings,
        errors
    };

    report.summary = createValidationSummary(report);
    return report;
}

function finalizeValidationReport(report) {
    return {
        ...report,
        summary: createValidationSummary(report)
    };
}

module.exports = {
    createEmptyValidationReport,
    createValidationSummary,
    finalizeValidationReport
};
