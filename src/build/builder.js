const fs = require('fs');
const path = require('path');

const { finalizeDecision } = require('./decision-model');
const { buildArbiterStats } = require('../arbiter/arbiter');
const { runArbiter } = require('../arbiter/run-arbiter');
const { createClassificationContext } = require('../classification/context');
const { classifyModFile } = require('../classification/classify-mod-file');
const { buildClassificationStats } = require('../classification/temporary-merge-policy');
const { createEmptyDeepCheckSummary } = require('../deep-check/constants');
const { runDeepCheck } = require('../deep-check/run-deep-check');
const { analyzeDependencies } = require('../dependency/analyze');
const { FileCopyError, OutputDirectoryError, ResultCollisionError } = require('../core/errors');
const { ensureDirectory } = require('../io/history');
const { listJarFiles } = require('../io/mods-folder');
const { buildParsingStats } = require('../metadata/parse-mod-file');
const { createEmptyValidationReport } = require('../validation/report-model');
const { runValidationStage } = require('../validation/run-validation');

function emitLoggerEvent(logger, level, kind, message) {
    if (!logger) {
        return;
    }

    if (kind === 'analysis' && typeof logger.analysis === 'function') {
        logger.analysis(message);
        return;
    }

    if (kind === 'decision' && typeof logger.decision === 'function') {
        logger.decision(message);
        return;
    }

    if (kind === 'discovery' && typeof logger.discovery === 'function') {
        logger.discovery(message);
        return;
    }

    if (kind === 'jar' && typeof logger.jar === 'function') {
        logger.jar(message);
        return;
    }

    if (kind === 'parse' && typeof logger.parse === 'function') {
        logger.parse(message);
        return;
    }

    if (kind === 'parse-warn' && typeof logger.parseWarn === 'function') {
        logger.parseWarn(message);
        return;
    }

    if (kind === 'parse-error' && typeof logger.parseError === 'function') {
        logger.parseError(message);
        return;
    }

    if (kind === 'engine-execution' && typeof logger.engine === 'function') {
        logger.engine(message);
        return;
    }

    if (kind === 'engine-decision' && typeof logger.engineDecision === 'function') {
        logger.engineDecision(message);
        return;
    }

    if (kind === 'engine-warning' && typeof logger.engineWarning === 'function') {
        logger.engineWarning(message);
        return;
    }

    if (kind === 'engine-error' && typeof logger.engineError === 'function') {
        logger.engineError(message);
        return;
    }

    if (kind === 'engine-conflict' && typeof logger.engineConflict === 'function') {
        logger.engineConflict(message);
        return;
    }

    if (kind === 'classification' && typeof logger.classification === 'function') {
        logger.classification(message);
        return;
    }

    if (kind === 'graph' && typeof logger.graph === 'function') {
        logger.graph(message);
        return;
    }

    if (kind === 'graph-warn' && typeof logger.graphWarn === 'function') {
        logger.graphWarn(message);
        return;
    }

    if (kind === 'graph-error' && typeof logger.graphError === 'function') {
        logger.graphError(message);
        return;
    }

    if (kind === 'dependency' && typeof logger.dependency === 'function') {
        logger.dependency(message);
        return;
    }

    if (kind === 'dependency-preserve' && typeof logger.dependencyPreserve === 'function') {
        logger.dependencyPreserve(message);
        return;
    }

    if (kind === 'arbiter' && typeof logger.arbiter === 'function') {
        logger.arbiter(message);
        return;
    }

    if (kind === 'arbiter-warn' && typeof logger.arbiterWarn === 'function') {
        logger.arbiterWarn(message);
        return;
    }

    if (kind === 'arbiter-review' && typeof logger.arbiterReview === 'function') {
        logger.arbiterReview(message);
        return;
    }

    if (kind === 'arbiter-error' && typeof logger.arbiterError === 'function') {
        logger.arbiterError(message);
        return;
    }

    if (kind === 'deep-check' && typeof logger.deepCheck === 'function') {
        logger.deepCheck(message);
        return;
    }

    if (kind === 'deep-check-warn' && typeof logger.deepCheckWarn === 'function') {
        logger.deepCheckWarn(message);
        return;
    }

    if (kind === 'deep-check-review' && typeof logger.deepCheckReview === 'function') {
        logger.deepCheckReview(message);
        return;
    }

    if (kind === 'deep-check-error' && typeof logger.deepCheckError === 'function') {
        logger.deepCheckError(message);
        return;
    }

    if (kind === 'build' && typeof logger.buildAction === 'function') {
        logger.buildAction(message);
        return;
    }

    if (kind === 'validation' && typeof logger.validation === 'function') {
        logger.validation(message);
        return;
    }

    if (kind === 'validation-warn' && typeof logger.validationWarn === 'function') {
        logger.validationWarn(message);
        return;
    }

    if (kind === 'validation-error' && typeof logger.validationError === 'function') {
        logger.validationError(message);
        return;
    }

    if (kind === 'validation-skip' && typeof logger.validationSkip === 'function') {
        logger.validationSkip(message);
        return;
    }

    if (kind === 'dry-run' && typeof logger.dryRunAction === 'function') {
        logger.dryRunAction(message);
        return;
    }

    if (kind === 'report' && typeof logger.report === 'function') {
        logger.report(message);
        return;
    }

    switch (level) {
        case 'error':
            logger.error(message);
            break;
        case 'warn':
            logger.warn(message);
            break;
        case 'success':
            logger.success(message);
            break;
        default:
            logger.info(message);
            break;
    }
}

function createEventCollector(logger) {
    const events = [];

    function record(level, kind, message) {
        events.push({
            timestamp: new Date().toISOString(),
            level,
            kind,
            message
        });

        emitLoggerEvent(logger, level, kind, message);
    }

    return {
        events,
        record
    };
}

function ensureBuildDirectories(runContext) {
    try {
        ensureDirectory(runContext.outputRootDir);
        ensureDirectory(runContext.buildDir);
        ensureDirectory(runContext.buildModsDir);
    } catch (error) {
        throw new OutputDirectoryError(`Failed to prepare output directory: ${runContext.buildDir}`, { cause: error });
    }
}

function copyKeptFile(sourcePath, destinationPath) {
    if (fs.existsSync(destinationPath)) {
        throw new ResultCollisionError(`File already exists in output: ${destinationPath}`);
    }

    try {
        fs.copyFileSync(sourcePath, destinationPath, fs.constants.COPYFILE_EXCL);
    } catch (error) {
        if (error instanceof ResultCollisionError) {
            throw error;
        }

        throw new FileCopyError(`Failed to copy file: ${path.basename(sourcePath)}`, { cause: error });
    }
}

function collectDecisions(modsPath, classificationContext, runContext, record = () => {}) {
    const jarFiles = listJarFiles(modsPath);

    const decisions = jarFiles.map((fileName) =>
        classifyModFile({
            fileName,
            sourcePath: path.join(modsPath, fileName),
            classificationContext,
            runContext,
            record
        })
    );

    return {
        jarFiles,
        decisions
    };
}

function applyBuildActions({ decisions, runContext, record }) {
    const finalized = [];

    if (!runContext.dryRun) {
        ensureBuildDirectories(runContext);
    }

    for (const decision of decisions) {
        if (decision.decision === 'exclude') {
            const excludedDecision = finalizeDecision(decision, {
                actionStatus: runContext.dryRun ? 'would-exclude' : 'excluded'
            });
            const excludedMessage = `${runContext.dryRun ? 'Would exclude' : 'Excluded'}: ${decision.fileName}`;

            record('info', runContext.dryRun ? 'dry-run' : 'build', excludedMessage);
            finalized.push(excludedDecision);
            continue;
        }

        const destinationPath = path.join(runContext.buildModsDir, decision.fileName);

        if (runContext.dryRun) {
            record('info', 'dry-run', `Would copy: ${decision.fileName}`);
            finalized.push(finalizeDecision(decision, {
                actionStatus: 'would-copy',
                destinationPath
            }));
            continue;
        }

        try {
            copyKeptFile(decision.sourcePath, destinationPath);
            record('success', 'build', `Copied: ${decision.fileName}`);
            finalized.push(finalizeDecision(decision, {
                actionStatus: 'copied',
                destinationPath
            }));
        } catch (error) {
            record('error', 'build', error.message);
            finalized.push(finalizeDecision(decision, {
                actionStatus: 'error',
                destinationPath,
                error: {
                    code: error.code || 'BUILD_ACTION_ERROR',
                    message: error.message
                }
            }));
        }
    }

    return finalized;
}

function buildStats(decisions) {
    return {
        totalJarFiles: decisions.length,
        kept: decisions.filter((item) => item.decision === 'keep').length,
        excluded: decisions.filter((item) => item.decision === 'exclude').length,
        copied: decisions.filter((item) => item.actionStatus === 'copied').length,
        wouldCopy: decisions.filter((item) => item.actionStatus === 'would-copy').length,
        wouldExclude: decisions.filter((item) => item.actionStatus === 'would-exclude').length,
        errors: decisions.filter((item) => item.actionStatus === 'error').length
    };
}

function collectReportIssues(decisions) {
    const warnings = [];
    const errors = [];

    for (const decision of decisions) {
        if (decision.descriptor) {
            for (const warning of decision.descriptor.parsingWarnings) {
                warnings.push({
                    fileName: decision.fileName,
                    source: warning.source,
                    code: warning.code,
                    message: warning.message
                });
            }

            for (const error of decision.descriptor.parsingErrors) {
                errors.push({
                    fileName: decision.fileName,
                    source: error.source,
                    code: error.code,
                    message: error.message,
                    fatal: Boolean(error.fatal)
                });
            }
        }

        if (decision.classification) {
            for (const result of decision.classification.results) {
                for (const warning of result.warnings) {
                    warnings.push({
                        fileName: decision.fileName,
                        source: result.engine,
                        code: 'ENGINE_WARNING',
                        message: warning
                    });
                }

                if (result.error) {
                    errors.push({
                        fileName: decision.fileName,
                        source: result.engine,
                        code: result.error.code,
                        message: result.error.message,
                        fatal: false
                    });
                }
            }
        }

        if (decision.error) {
            errors.push({
                fileName: decision.fileName,
                source: 'build',
                code: decision.error.code,
                message: decision.error.message,
                fatal: false
            });
        }

        if (decision.deepCheck) {
            for (const warning of decision.deepCheck.warnings || []) {
                warnings.push({
                    fileName: decision.fileName,
                    source: 'deep-check',
                    code: 'DEEP_CHECK_WARNING',
                    message: warning
                });
            }

            for (const error of decision.deepCheck.errors || []) {
                errors.push({
                    fileName: decision.fileName,
                    source: 'deep-check',
                    code: error.code || 'DEEP_CHECK_ERROR',
                    message: error.message,
                    fatal: false
                });
            }
        }
    }

    return {
        warnings,
        errors
    };
}

function createEmptyDependencyGraph(mode, error = null) {
    return {
        status: error ? 'error' : 'skipped',
        mode,
        summary: {
            status: error ? 'error' : 'skipped',
            totalNodes: 0,
            totalEdges: 0,
            requiredEdges: 0,
            optionalEdges: 0,
            incompatibilityEdges: 0,
            multiModJars: 0,
            filesWithFindings: 0,
            totalFindings: 0,
            missingRequired: 0,
            missingOptional: 0,
            ambiguousProviders: 0,
            incompatibilities: 0,
            preservedByDependency: 0,
            orphanLibraries: 0,
            graphErrors: error ? 1 : 0
        },
        providerIndex: {
            byId: {},
            providerEntries: [],
            summary: {
                uniqueProvidedIds: 0,
                providerEntries: 0,
                ambiguousIds: [],
                ambiguousIdsCount: 0,
                multiModJarCount: 0
            }
        },
        nodes: [],
        edges: [],
        findings: [],
        errors: error ? [error] : []
    };
}

function runDependencyStage({ decisions, runContext, record }) {
    try {
        const result = analyzeDependencies({
            decisions,
            mode: runContext.dependencyValidationMode,
            record
        });

        return {
            decisions: result.decisions,
            dependencyGraph: result.report
        };
    } catch (error) {
        const serializedError = {
            code: error.code || 'DEPENDENCY_GRAPH_ERROR',
            message: error.message
        };

        record('error', 'graph-error', `Dependency graph analysis failed: ${error.message}`);

        return {
            decisions,
            dependencyGraph: createEmptyDependencyGraph(runContext.dependencyValidationMode, serializedError)
        };
    }
}

function createEmptyArbiterReport(profile, error = null) {
    return {
        status: error ? 'error' : 'skipped',
        profile,
        summary: {
            profile,
            finalDecisions: {
                keep: 0,
                remove: 0,
                review: 0
            },
            confidence: {
                high: 0,
                medium: 0,
                low: 0,
                none: 0
            },
            requiresDeepCheck: 0,
            reviewKeptInBuild: 0,
            reviewExcludedInBuild: 0,
            profileDrivenAdjustments: 0
        },
        errors: error ? [error] : []
    };
}

function createEmptyDeepCheckReport(mode, error = null) {
    return {
        status: error ? 'error' : 'skipped',
        mode,
        summary: createEmptyDeepCheckSummary(mode),
        errors: error ? [error] : []
    };
}

function createEmptyValidation(mode, error = null) {
    return createEmptyValidationReport(mode, {
        status: error ? 'error' : 'skipped',
        skipReason: error ? null : 'Validation stage was not run',
        errors: error ? [error] : []
    });
}

function runArbiterStage({ decisions, runContext, record }) {
    try {
        record('info', 'arbiter', `Starting arbiter for ${decisions.length} jar(s) with profile ${runContext.arbiterProfile}`);
        const result = runArbiter({
            decisions,
            runContext,
            record
        });
        record('info', 'arbiter', `Arbiter completed for ${decisions.length} jar(s)`);

        return {
            decisions: result.decisions,
            arbiter: {
                status: 'ok',
                profile: runContext.arbiterProfile,
                summary: buildArbiterStats(result.decisions, runContext.arbiterProfile),
                errors: []
            }
        };
    } catch (error) {
        const serializedError = {
            code: error.code || 'ARBITER_STAGE_ERROR',
            message: error.message
        };

        record('error', 'arbiter-error', `Arbiter failed: ${error.message}`);

        return {
            decisions,
            arbiter: createEmptyArbiterReport(runContext.arbiterProfile, serializedError)
        };
    }
}

function runDeepCheckStage({ decisions, runContext, record }) {
    try {
        record('info', 'deep-check', `Starting deep-check for disputed mods with mode ${runContext.deepCheckMode}`);
        const result = runDeepCheck({
            decisions,
            runContext,
            record
        });
        record('info', 'deep-check', `Deep-check completed for ${decisions.length} jar(s)`);

        return {
            decisions: result.decisions,
            deepCheck: result.report
        };
    } catch (error) {
        const serializedError = {
            code: error.code || 'DEEP_CHECK_STAGE_ERROR',
            message: error.message
        };

        record('error', 'deep-check-error', `Deep-check stage failed: ${error.message}`);

        return {
            decisions,
            deepCheck: createEmptyDeepCheckReport(runContext.deepCheckMode, serializedError)
        };
    }
}

async function runBuildPipeline({ modsPath, blockList = [], classificationContext = null, runContext, logger }) {
    const effectiveClassificationContext = classificationContext || createClassificationContext({ blockList });
    const collector = createEventCollector(logger);
    collector.record('info', 'analysis', `Run mode: ${runContext.mode}`);
    collector.record('info', 'analysis', `Input directory: ${modsPath}`);
    collector.record('info', 'analysis', `Build root: ${runContext.outputRootDir}`);
    collector.record('info', 'analysis', `Report root: ${runContext.reportRootDir}`);
    collector.record('info', 'analysis', `Classification engines: ${effectiveClassificationContext.enabledEngines.join(', ')}`);
    collector.record('info', 'analysis', `Dependency validation mode: ${runContext.dependencyValidationMode}`);
    collector.record('info', 'analysis', `Arbiter profile: ${runContext.arbiterProfile}`);
    collector.record('info', 'analysis', `Deep-check mode: ${runContext.deepCheckMode}`);

    const { decisions: classifiedDecisions } = collectDecisions(modsPath, effectiveClassificationContext, runContext, collector.record);
    collector.record('info', 'analysis', `Discovered .jar files: ${classifiedDecisions.length}`);

    const dependencyStage = runDependencyStage({
        decisions: classifiedDecisions,
        runContext,
        record: collector.record
    });
    const arbiterStage = runArbiterStage({
        decisions: dependencyStage.decisions,
        runContext,
        record: collector.record
    });
    const deepCheckStage = runDeepCheckStage({
        decisions: arbiterStage.decisions,
        runContext,
        record: collector.record
    });
    const decisions = deepCheckStage.decisions;

    for (const decision of decisions) {
        const engine = decision.classification ? decision.classification.winningEngine || 'conservative-default' : 'unknown';
        const semantic = decision.finalSemanticDecision || decision.arbiterDecision || 'unknown';
        const confidence = decision.finalConfidence || decision.arbiterConfidence || 'none';
        collector.record(
            'info',
            'decision',
            `Decision ${decision.decision}: ${decision.fileName} | semantic: ${semantic} | confidence: ${confidence} | engine: ${engine} | origin: ${decision.decisionOrigin} | ${decision.reason}`
        );
    }

    const finalizedDecisions = applyBuildActions({
        decisions,
        runContext,
        record: collector.record
    });
    let validationStage = {
        validation: createEmptyValidation(runContext.validationMode)
    };

    try {
        validationStage = await runValidationStage({
            decisions: finalizedDecisions,
            runContext,
            record: collector.record
        });
    } catch (error) {
        const serializedError = {
            code: error.code || 'VALIDATION_STAGE_ERROR',
            message: error.message
        };

        collector.record('error', 'validation-error', `Validation stage crashed: ${error.message}`);
        validationStage = {
            validation: createEmptyValidation(runContext.validationMode, serializedError)
        };
    }

    const completedAt = new Date().toISOString();
    const stats = buildStats(finalizedDecisions);
    const issues = collectReportIssues(finalizedDecisions);

    for (const error of dependencyStage.dependencyGraph.errors) {
        issues.errors.push({
            fileName: null,
            source: 'dependency-graph',
            code: error.code,
            message: error.message,
            fatal: false
        });
    }

    for (const error of arbiterStage.arbiter.errors) {
        issues.errors.push({
            fileName: null,
            source: 'arbiter',
            code: error.code,
            message: error.message,
            fatal: false
        });
    }

    for (const error of deepCheckStage.deepCheck.errors) {
        issues.errors.push({
            fileName: null,
            source: 'deep-check',
            code: error.code,
            message: error.message,
            fatal: false
        });
    }

    for (const warning of validationStage.validation.warnings || []) {
        issues.warnings.push({
            fileName: null,
            source: 'validation',
            code: 'VALIDATION_WARNING',
            message: warning
        });
    }

    for (const error of validationStage.validation.errors || []) {
        issues.errors.push({
            fileName: null,
            source: 'validation',
            code: error.code,
            message: error.message,
            fatal: false
        });
    }

    return {
        run: {
            runId: runContext.runId,
            runIdPrefix: runContext.runIdPrefix,
            startedAt: runContext.startedAt,
            completedAt,
            inputPath: modsPath,
            outputRootDir: runContext.outputRootDir,
            reportRootDir: runContext.reportRootDir,
            outputPolicy: runContext.outputPolicy,
            buildDir: runContext.buildDir,
            buildModsDir: runContext.buildModsDir,
            reportDir: runContext.reportDir,
            dryRun: runContext.dryRun,
            mode: runContext.mode,
            dependencyValidationMode: runContext.dependencyValidationMode,
            arbiterProfile: runContext.arbiterProfile,
            deepCheckMode: runContext.deepCheckMode,
            validationMode: runContext.validationMode,
            validationTimeoutMs: runContext.validationTimeoutMs,
            validationEntrypointPath: runContext.validationEntrypointPath,
            validationSaveArtifacts: runContext.validationSaveArtifacts,
            registryMode: runContext.registryMode,
            registryManifestUrl: runContext.registryManifestUrl,
            registryBundleUrl: runContext.registryBundleUrl,
            registryCacheDir: runContext.registryCacheDir,
            localOverridesPath: runContext.localOverridesPath,
            enabledEngines: effectiveClassificationContext.enabledEngines,
            registryFilePath: effectiveClassificationContext.localRegistry ? effectiveClassificationContext.localRegistry.filePath : null
        },
        stats,
        parsing: buildParsingStats(finalizedDecisions),
        classification: buildClassificationStats(finalizedDecisions, effectiveClassificationContext.enabledEngines),
        dependencyGraph: dependencyStage.dependencyGraph,
        arbiter: arbiterStage.arbiter,
        deepCheck: deepCheckStage.deepCheck,
        validation: validationStage.validation,
        decisions: finalizedDecisions,
        events: collector.events,
        warnings: issues.warnings,
        errors: issues.errors
    };
}

module.exports = {
    buildStats,
    collectDecisions,
    runBuildPipeline
};
