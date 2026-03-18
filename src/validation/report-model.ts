const { VALIDATION_STATUSES } = require('./constants');

import type { ValidationError, ValidationMode, ValidationResult, ValidationStatus, ValidationSummary } from '../types/validation';

function createValidationSummary(report: Pick<ValidationResult, 'issues' | 'suspectedFalseRemovals' | 'successMarkers' | 'failureMarkers'>): ValidationSummary {
    return {
        totalIssues: report.issues.length,
        suspectedFalseRemovals: report.suspectedFalseRemovals.length,
        successMarkers: report.successMarkers.length,
        failureMarkers: report.failureMarkers.length,
        linkedIssues: report.issues.filter((issue) => Array.isArray(issue.linkedDecisions) && issue.linkedDecisions.length > 0).length
    };
}

function createEmptyValidationReport(
    mode: ValidationMode,
    {
        status = VALIDATION_STATUSES.notRun,
        skipReason = null,
        errors = [],
        warnings = []
    }: {
        status?: ValidationStatus;
        skipReason?: string | null;
        errors?: ValidationError[];
        warnings?: string[];
    } = {}
): ValidationResult {
    const report: ValidationResult = {
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
        errors,
        summary: {
            totalIssues: 0,
            suspectedFalseRemovals: 0,
            successMarkers: 0,
            failureMarkers: 0,
            linkedIssues: 0
        }
    };

    report.summary = createValidationSummary(report);
    return report;
}

function finalizeValidationReport(report: ValidationResult): ValidationResult {
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
