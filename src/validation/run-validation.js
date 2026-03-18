const fs = require('fs');
const path = require('path');

const { ensureDirectory } = require('../io/history');
const {
    DEFAULT_VALIDATION_LOG_FILE_NAME,
    DEFAULT_VALIDATION_STDERR_FILE_NAME,
    DEFAULT_VALIDATION_STDOUT_FILE_NAME,
    VALIDATION_MODES,
    VALIDATION_STATUSES
} = require('./constants');
const { materializeExplicitEntrypoint, resolveValidationEntrypoint } = require('./entrypoint-resolver');
const { parseValidationIssues } = require('./error-parser');
const { linkValidationIssues } = require('./link-issues');
const { createEmptyValidationReport, finalizeValidationReport } = require('./report-model');
const { runValidationProcess } = require('./process-runner');

function prepareValidationWorkspace(runContext) {
    ensureDirectory(runContext.tmpRootDir);
    const workspaceRoot = fs.mkdtempSync(path.join(runContext.tmpRootDir, `${runContext.runId}-validation-`));
    const workspaceDir = path.join(workspaceRoot, 'server');
    fs.cpSync(runContext.buildDir, workspaceDir, { recursive: true });

    return {
        workspaceRoot,
        workspaceDir
    };
}

function cleanupValidationWorkspace(workspaceRoot) {
    if (!workspaceRoot || !fs.existsSync(workspaceRoot)) {
        return;
    }

    fs.rmSync(workspaceRoot, { recursive: true, force: true });
}

function writeValidationArtifacts({ runContext, stdout, stderr, combinedOutput, saveArtifacts }) {
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

function shouldSaveValidationArtifacts(runContext, status) {
    return Boolean(runContext.validationSaveArtifacts || status !== VALIDATION_STATUSES.passed);
}

function buildValidationError(code, message) {
    return {
        code,
        message
    };
}

function createSkippedValidation(mode, skipReason, warnings = []) {
    return finalizeValidationReport(createEmptyValidationReport(mode, {
        status: VALIDATION_STATUSES.skipped,
        skipReason,
        warnings
    }));
}

function createErrorValidation(mode, message, { warnings = [], startedAt = null, finishedAt = null } = {}) {
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

function createRunPolicyDecision({ runContext, decisions }) {
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

function determineValidationStatus(processRuntime, parsedIssues, successMarkers) {
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

function ensureFailureIssue(issues, processRuntime) {
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

async function runValidationStage({ decisions, runContext, record = () => {} }) {
    const policy = createRunPolicyDecision({ runContext, decisions });

    if (!policy.shouldRun) {
        if (policy.report.status === VALIDATION_STATUSES.error) {
            record('error', 'validation-error', policy.report.errors[0].message);
        } else {
            record('warn', 'validation-skip', policy.report.skipReason);
        }

        return {
            validation: policy.report
        };
    }

    let workspaceRoot = null;

    try {
        record('info', 'validation', `Preparing validation workspace for run ${runContext.runId}`);
        const workspace = prepareValidationWorkspace(runContext);
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
            record('warn', 'validation-skip', skipped.skipReason);

            return {
                validation: finalizeValidationReport(skipped)
            };
        }

        record('info', 'validation', `Validation entrypoint: ${entrypoint.path}`);
        const processRuntime = await runValidationProcess({
            entrypoint,
            workingDirectory: workspace.workspaceDir,
            timeoutMs: runContext.validationTimeoutMs,
            record
        });
        const parsed = parseValidationIssues(processRuntime.combinedOutput);
        const ensuredIssues = ensureFailureIssue(parsed.issues, processRuntime);
        const linked = linkValidationIssues({
            issues: ensuredIssues,
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
        const errors = [];

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
            logArtifacts,
            warnings: [],
            errors
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
            validation: report
        };
    } catch (error) {
        record('error', 'validation-error', `Validation stage failed before process start: ${error.message}`);

        return {
            validation: createErrorValidation(runContext.validationMode, error.message)
        };
    } finally {
        cleanupValidationWorkspace(workspaceRoot);
    }
}

module.exports = {
    runValidationStage
};
