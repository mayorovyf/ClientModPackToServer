const fs = require('node:fs');
const path = require('node:path');

const { ensureDirectory } = require('../io/history');
const { cleanupValidationSandbox, createValidationSandbox } = require('./sandbox');
const { projectDeterministicJoinability } = require('./joinability-projection');
const { detectJoinabilityFailureMarkers, detectJoinabilitySuccessMarkers } = require('./markers');
const {
    DEFAULT_VALIDATION_LOG_FILE_NAME,
    DEFAULT_VALIDATION_STDOUT_FILE_NAME,
    DEFAULT_VALIDATION_STDERR_FILE_NAME,
    VALIDATION_MODES,
    VALIDATION_STATUSES
} = require('./constants');
const { materializeExplicitEntrypoint, resolveValidationEntrypoint } = require('./entrypoint-resolver');
const { parseValidationIssues } = require('./error-parser');
const { linkValidationIssues } = require('./link-issues');
const { createEmptyValidationReport, finalizeValidationReport } = require('./report-model');
const { runValidationProcess } = require('./process-runner');

import type { RunContext } from '../types/run';
import type {
    ValidationDecisionLike,
    ValidationError,
    ValidationIssue,
    ValidationJoinabilityResult,
    ValidationLogArtifacts,
    ValidationMode,
    ValidationProcessRuntime,
    ValidationResult,
    ValidationStageResult,
    ValidationStatus
} from '../types/validation';

function writeValidationArtifacts({
    runContext,
    stdout,
    stderr,
    combinedOutput,
    saveArtifacts
}: {
    runContext: RunContext;
    stdout: string;
    stderr: string;
    combinedOutput: string;
    saveArtifacts: boolean;
}): ValidationLogArtifacts {
    if (!saveArtifacts) {
        return {};
    }

    ensureDirectory(runContext.reportRootDir);
    ensureDirectory(runContext.reportDir);

    const combinedLogPath = path.join(runContext.reportDir, DEFAULT_VALIDATION_LOG_FILE_NAME);
    const stdoutLogPath = path.join(runContext.reportDir, DEFAULT_VALIDATION_STDOUT_FILE_NAME);
    const stderrLogPath = path.join(runContext.reportDir, DEFAULT_VALIDATION_STDERR_FILE_NAME);

    fs.writeFileSync(combinedLogPath, combinedOutput || '', 'utf8');
    fs.writeFileSync(stdoutLogPath, stdout || '', 'utf8');
    fs.writeFileSync(stderrLogPath, stderr || '', 'utf8');

    return {
        combinedLogPath,
        stdoutLogPath,
        stderrLogPath
    };
}

function shouldSaveValidationArtifacts(runContext: RunContext, status: ValidationStatus): boolean {
    return Boolean(runContext.validationSaveArtifacts || status !== VALIDATION_STATUSES.passed);
}

function buildValidationError(code: string, message: string): ValidationError {
    return {
        code,
        message
    };
}

function createSkippedValidation(mode: ValidationMode, skipReason: string, warnings: string[] = []): ValidationResult {
    return finalizeValidationReport(createEmptyValidationReport(mode, {
        status: VALIDATION_STATUSES.skipped,
        skipReason,
        warnings
    }));
}

function createErrorValidation(
    mode: ValidationMode,
    message: string,
    {
        warnings = [],
        startedAt = null,
        finishedAt = null
    }: {
        warnings?: string[];
        startedAt?: string | null;
        finishedAt?: string | null;
    } = {}
): ValidationResult {
    const report = createEmptyValidationReport(mode, {
        status: VALIDATION_STATUSES.error,
        errors: [buildValidationError('VALIDATION_STAGE_ERROR', message)],
        warnings
    });

    report.startedAt = startedAt;
    report.finishedAt = finishedAt || new Date().toISOString();
    report.durationMs = startedAt ? Math.max(0, new Date(report.finishedAt).getTime() - new Date(startedAt).getTime()) : 0;

    return finalizeValidationReport(report);
}

function createRunPolicyDecision({
    runContext,
    decisions
}: {
    runContext: RunContext;
    decisions: ValidationDecisionLike[];
}): { shouldRun: boolean; report: ValidationResult | null } {
    const buildErrors = decisions.filter((decision) => decision.actionStatus === 'error').length;

    if (runContext.validationMode === VALIDATION_MODES.off) {
        return {
            shouldRun: false,
            report: createSkippedValidation(runContext.validationMode, 'Validation disabled by configuration')
        };
    }

    if (runContext.dryRun) {
        if (runContext.validationMode === VALIDATION_MODES.require || runContext.validationMode === VALIDATION_MODES.force) {
            return {
                shouldRun: false,
                report: createErrorValidation(runContext.validationMode, 'Validation requires build output and cannot run in dry-run mode')
            };
        }

        return {
            shouldRun: false,
            report: createSkippedValidation(runContext.validationMode, 'Validation skipped because dry-run did not create build output')
        };
    }

    if (runContext.validationMode === VALIDATION_MODES.auto && buildErrors > 0) {
        return {
            shouldRun: false,
            report: createSkippedValidation(
                runContext.validationMode,
                `Validation skipped because build stage reported ${buildErrors} file action error(s)`,
                [`Build stage reported ${buildErrors} file action error(s)`]
            )
        };
    }

    return {
        shouldRun: true,
        report: null
    };
}

function determineValidationStatus(
    processRuntime: ValidationProcessRuntime,
    parsedIssues: ValidationIssue[],
    successMarkers: ValidationResult['successMarkers']
): ValidationStatus {
    if (processRuntime.spawnError) {
        return VALIDATION_STATUSES.error;
    }

    if (processRuntime.timedOut) {
        return VALIDATION_STATUSES.timedOut;
    }

    if (parsedIssues.length > 0) {
        return VALIDATION_STATUSES.failed;
    }

    if (successMarkers.length > 0) {
        return VALIDATION_STATUSES.passed;
    }

    return VALIDATION_STATUSES.failed;
}

function deriveJoinabilityResult({
    output,
    issues,
    decisions
}: {
    output: string;
    issues: ValidationIssue[];
    decisions: ValidationDecisionLike[];
}): ValidationJoinabilityResult {
    const successMarkers = detectJoinabilitySuccessMarkers(output);
    const failureMarkers = detectJoinabilityFailureMarkers(output);
    const joinabilityIssues = issues.filter((issue) => issue.kind === 'joinability-failure');
    const projection = projectDeterministicJoinability({
        decisions
    });
    const evidence = [
        ...failureMarkers.map((marker: ValidationJoinabilityResult['failureMarkers'][number]) => marker.evidence),
        ...joinabilityIssues.map((issue) => issue.evidence),
        ...successMarkers.map((marker: ValidationJoinabilityResult['successMarkers'][number]) => marker.evidence),
        ...projection.evidence
    ].filter(Boolean).slice(0, 5);
    const checkedBy = [
        ...(successMarkers.length > 0 || failureMarkers.length > 0 || joinabilityIssues.length > 0 ? ['runtime-markers' as const] : []),
        ...projection.checkedBy
    ];

    if (failureMarkers.length > 0 || joinabilityIssues.length > 0) {
        return {
            status: 'failed',
            successMarkers,
            failureMarkers,
            evidence,
            checkedBy
        };
    }

    if (projection.status === 'failed') {
        return {
            status: 'failed',
            successMarkers,
            failureMarkers,
            evidence,
            checkedBy
        };
    }

    if (successMarkers.length > 0 || projection.status === 'passed') {
        return {
            status: 'passed',
            successMarkers,
            failureMarkers,
            evidence,
            checkedBy
        };
    }

    return {
        status: projection.status,
        successMarkers: [],
        failureMarkers: [],
        evidence: projection.evidence,
        checkedBy
    };
}

function ensureFailureIssue(issues: ValidationIssue[], processRuntime: ValidationProcessRuntime): ValidationIssue[] {
    if (issues.length > 0) {
        return issues;
    }

    if (processRuntime.successMarkers.length > 0) {
        return issues;
    }

    return [
        {
            kind: 'validation-no-success-marker',
            message: processRuntime.exitCode !== null
                ? `Validation process exited with code ${processRuntime.exitCode} without a reliable success marker`
                : 'Validation process finished without a reliable success marker',
            evidence: processRuntime.combinedOutput
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean)
                .slice(-3)
                .join(' | '),
            modIds: [],
            suspectedModIds: [],
            jarHints: [],
            confidence: 'low'
        }
    ];
}

async function runValidationStage({
    decisions,
    runContext,
    record = () => {}
}: {
    decisions: ValidationDecisionLike[];
    runContext: RunContext;
    record?: (level: string, kind: string, message: string) => void;
}): Promise<ValidationStageResult> {
    const policy = createRunPolicyDecision({ runContext, decisions });

    if (!policy.shouldRun) {
        const report = policy.report || createSkippedValidation(runContext.validationMode, 'Validation skipped by runtime policy');
        const firstError = report.errors[0];

        if (report.status === VALIDATION_STATUSES.error) {
            record('error', 'validation-error', firstError ? firstError.message : 'Validation stage failed');
        } else {
            record('warn', 'validation-skip', report.skipReason || 'Validation skipped');
        }

        return {
            validation: report
        };
    }

    let workspaceRoot: string | null = null;

    try {
        record('info', 'validation', `Preparing validation workspace for run ${runContext.runId}`);
        const workspace = createValidationSandbox(runContext);
        workspaceRoot = workspace.workspaceRoot;

        const explicitEntrypoint = materializeExplicitEntrypoint({
            buildDir: runContext.buildDir,
            workspaceDir: workspace.workspaceDir,
            explicitPath: runContext.validationEntrypointPath
        });
        const entrypoint = resolveValidationEntrypoint({
            workspaceDir: workspace.workspaceDir,
            explicitEntrypoint
        });

        if (!entrypoint) {
            if (runContext.validationMode === VALIDATION_MODES.require || runContext.validationMode === VALIDATION_MODES.force) {
                const message = 'Validation entrypoint was not found in the build output or explicit path';
                record('error', 'validation-error', message);

                return {
                    validation: finalizeValidationReport({
                        ...createErrorValidation(runContext.validationMode, message),
                        workingDirectory: workspace.workspaceDir
                    })
                };
            }

            const skipped = createSkippedValidation(runContext.validationMode, 'Validation skipped because server entrypoint was not found');
            skipped.workingDirectory = workspace.workspaceDir;
            record('warn', 'validation-skip', skipped.skipReason || 'Validation skipped');

            return {
                validation: finalizeValidationReport(skipped)
            };
        }

        record('info', 'validation', `Validation entrypoint: ${entrypoint.path}`);
        const processRuntime = await runValidationProcess({
            entrypoint,
            workingDirectory: workspace.workspaceDir,
            timeoutMs: runContext.validationTimeoutMs,
            javaProfile: runContext.javaProfile,
            record
        });
        const parsed = parseValidationIssues(processRuntime.combinedOutput);
        const ensuredIssues = ensureFailureIssue(parsed.issues, processRuntime);
        const linked = linkValidationIssues({
            issues: ensuredIssues,
            decisions
        });
        const joinability = deriveJoinabilityResult({
            output: processRuntime.combinedOutput,
            issues: linked.issues,
            decisions
        });
        const status = determineValidationStatus(processRuntime, linked.issues, processRuntime.successMarkers);
        const logArtifacts = writeValidationArtifacts({
            runContext,
            stdout: processRuntime.stdout,
            stderr: processRuntime.stderr,
            combinedOutput: processRuntime.combinedOutput,
            saveArtifacts: shouldSaveValidationArtifacts(runContext, status)
        });
        const errors: ValidationError[] = [];

        if (processRuntime.spawnError) {
            errors.push(buildValidationError('VALIDATION_PROCESS_ERROR', processRuntime.spawnError.message));
        }

        if ((runContext.validationMode === VALIDATION_MODES.require || runContext.validationMode === VALIDATION_MODES.force)
            && status !== VALIDATION_STATUSES.passed) {
            errors.push(buildValidationError('VALIDATION_REQUIREMENT_NOT_MET', `Validation mode ${runContext.validationMode} expected a passing smoke-test`));
        }

        const report = finalizeValidationReport({
            status,
            mode: runContext.validationMode,
            runAttempted: true,
            skipReason: null,
            startedAt: processRuntime.startedAt,
            finishedAt: processRuntime.finishedAt,
            durationMs: processRuntime.durationMs,
            entrypoint: {
                path: entrypoint.path,
                originalPath: entrypoint.originalPath || entrypoint.path,
                source: entrypoint.source,
                kind: entrypoint.kind
            },
            workingDirectory: workspace.workspaceDir,
            successMarkers: processRuntime.successMarkers,
            failureMarkers: parsed.failureMarkers,
            issues: linked.issues,
            suspectedFalseRemovals: linked.suspectedFalseRemovals,
            joinability,
            logArtifacts,
            warnings: [],
            errors,
            summary: {
                totalIssues: 0,
                suspectedFalseRemovals: 0,
                successMarkers: 0,
                failureMarkers: 0,
                linkedIssues: 0,
                joinabilityStatus: 'not-checked'
            }
        });

        if (status === VALIDATION_STATUSES.passed) {
            record('success', 'validation', 'Validation smoke-test passed');
        } else if (status === VALIDATION_STATUSES.timedOut) {
            record('warn', 'validation-warn', 'Validation smoke-test timed out');
        } else if (status === VALIDATION_STATUSES.failed) {
            record('warn', 'validation-warn', `Validation smoke-test failed with ${report.issues.length} issue(s)`);
        } else if (status === VALIDATION_STATUSES.error) {
            record('error', 'validation-error', report.errors[0] ? report.errors[0].message : 'Validation stage failed');
        }

        return {
            validation: report,
            sandboxStats: workspace.stats
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        record('error', 'validation-error', `Validation stage failed before process start: ${message}`);

        return {
            validation: createErrorValidation(runContext.validationMode, message)
        };
    } finally {
        cleanupValidationSandbox(workspaceRoot);
    }
}

module.exports = {
    runValidationStage
};
