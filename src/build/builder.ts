const fs = require('node:fs');
const path = require('node:path');

const { createFileDecision, finalizeDecision } = require('./decision-model');
const { buildArbiterStats } = require('../arbiter/arbiter');
const { runArbiter } = require('../arbiter/run-arbiter');
const { classifyDescriptor, classifyModFile } = require('../classification/classify-mod-file');
const { createEmptyDeepCheckSummary } = require('../deep-check/constants');
const { runDeepCheck } = require('../deep-check/run-deep-check');
const { analyzeDependencies } = require('../dependency/analyze');
const { FileCopyError, OutputDirectoryError, ResultCollisionError } = require('../core/errors');
const { ensureDirectory } = require('../io/history');
const { listJarFiles } = require('../io/mods-folder');
const { createEmptyValidationReport } = require('../validation/report-model');

import type { ApplicationLogger, BuildProgressReporter, ClassificationContextLike } from '../types/app';
import type { ClassificationContext, ConfidenceLevel, FinalClassification, RoleType, SemanticDecision } from '../types/classification';
import type { ModDescriptor } from '../types/descriptor';
import type { ReportEvent, ReportIssue, RunReport } from '../types/report';
import type { RunContext } from '../types/run';
import type { ValidationDecisionLike, ValidationError, ValidationResult, ValidationStageResult } from '../types/validation';

type LogLevel = 'info' | 'warn' | 'error' | 'success';
type RecordEvent = (level: string, kind: string, message: string) => void;

interface PipelineLogger extends ApplicationLogger {
    analysis?: (message: string) => void;
    decision?: (message: string) => void;
    discovery?: (message: string) => void;
    jar?: (message: string) => void;
    parse?: (message: string) => void;
    parseWarn?: (message: string) => void;
    parseError?: (message: string) => void;
    engine?: (message: string) => void;
    engineDecision?: (message: string) => void;
    engineWarning?: (message: string) => void;
    engineError?: (message: string) => void;
    engineConflict?: (message: string) => void;
    classification?: (message: string) => void;
    graph?: (message: string) => void;
    graphWarn?: (message: string) => void;
    graphError?: (message: string) => void;
    dependency?: (message: string) => void;
    dependencyPreserve?: (message: string) => void;
    arbiter?: (message: string) => void;
    arbiterWarn?: (message: string) => void;
    arbiterReview?: (message: string) => void;
    arbiterError?: (message: string) => void;
    deepCheck?: (message: string) => void;
    deepCheckWarn?: (message: string) => void;
    deepCheckReview?: (message: string) => void;
    deepCheckError?: (message: string) => void;
    buildAction?: (message: string) => void;
    validation?: (message: string) => void;
    validationWarn?: (message: string) => void;
    validationError?: (message: string) => void;
    validationSkip?: (message: string) => void;
    dryRunAction?: (message: string) => void;
}

interface PipelineDecision extends ValidationDecisionLike {
    fileName: string;
    sourcePath: string;
    descriptor: ModDescriptor | null;
    classification: FinalClassification | null;
    decision: 'keep' | 'exclude';
    reason: string;
    decisionOrigin: string;
    matchedRule: string | null;
    matchedRuleSource: string | null;
    dependencyAdjusted: boolean;
    dependencyReason: string | null;
    dependencyFindings: unknown[];
    dependencyDependencies: {
        required: unknown[];
        optional: unknown[];
        incompatibilities: unknown[];
    };
    dependencyDependents: {
        requiredBy: unknown[];
        optionalBy: unknown[];
        incompatibleWith: unknown[];
    };
    arbiter: unknown;
    arbiterDecision: SemanticDecision | string | null;
    arbiterConfidence: string | null;
    arbiterReasons: string[];
    arbiterWinningEvidence: unknown[];
    finalSemanticDecision: SemanticDecision | string | null;
    finalConfidence: string | null;
    finalDecisionOrigin: string | null;
    finalReasons: string[];
    finalRoleType: RoleType | null;
    roleConfidence: ConfidenceLevel | null;
    roleOrigin: string | null;
    roleReason: string | null;
    requiresReview: boolean;
    requiresDeepCheck: boolean;
    deepCheck: {
        warnings?: string[];
        errors?: ValidationError[];
    } | null;
    deepCheckStatus: string | null;
    deepCheckDecision: SemanticDecision | string | null;
    deepCheckConfidence: string | null;
    deepCheckChangedDecision: boolean;
    actionStatus: string;
    destinationPath: string | null;
    error: ValidationError | null;
    manualReviewKey: string | null;
    manualOverrideAction: 'keep' | 'exclude' | null;
    manualOverrideReason: string | null;
    manualOverrideUpdatedAt: string | null;
    probeOutcome?: string | null;
    probeReason?: string | null;
    probeConfidence?: string | null;
    probeLogPath?: string | null;
}

interface BuildPipelineReport extends RunReport {
    decisions: PipelineDecision[];
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function getErrorCode(error: unknown, fallbackCode: string): string {
    if (error && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string') {
        return (error as { code: string }).code;
    }

    return fallbackCode;
}

function emitLoggerEvent(logger: PipelineLogger | null | undefined, level: LogLevel, kind: string, message: string): void {
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

function createEventCollector(logger: PipelineLogger | null | undefined): {
    events: ReportEvent[];
    record: RecordEvent;
} {
    const events: ReportEvent[] = [];

    function record(level: string, kind: string, message: string): void {
        events.push({
            timestamp: new Date().toISOString(),
            level,
            kind,
            message
        });

        emitLoggerEvent(logger, (level as LogLevel) || 'info', kind, message);
    }

    return {
        events,
        record
    };
}

function createNoopProgressReporter(): BuildProgressReporter {
    return {
        onStageStarted(_event) {},
        onStageCompleted(_event) {},
        onModParsed(_event) {},
        onBuildActionCompleted(_event) {}
    };
}

// Copy the whole instance into the server output, except explicit client-only data
// and transient project/runtime directories. Everything else is treated as server-relevant
// and copied as-is, including kubejs/scripts/configureddefaults/patchouli_books/etc.
const INSTANCE_COPY_EXCLUDED_NAMES = new Set([
    'mods',
    'resourcepacks',
    'shaderpacks',
    'screenshots',
    'saves',
    'logs',
    'crash-reports',
    'downloads',
    'build',
    'reports',
    'tmp',
    'cache'
]);

const INSTANCE_COPY_EXCLUDED_FILE_NAMES = new Set([
    'options.txt',
    'optionsof.txt',
    'optionsshaders.txt',
    'options.amecsapi.txt',
    'servers.dat',
    'servers.dat_old',
    'realms_persistence.json',
    'launcher_profiles.json',
    'launcher_accounts.json',
    'usercache.json',
    'usernamecache.json'
]);

function isSamePath(leftPath: string, rightPath: string): boolean {
    return path.resolve(leftPath) === path.resolve(rightPath);
}

function shouldSkipInstanceEntry(sourcePath: string, entryName: string, runContext: RunContext): boolean {
    if (INSTANCE_COPY_EXCLUDED_NAMES.has(entryName.toLowerCase())) {
        return true;
    }

    if (INSTANCE_COPY_EXCLUDED_FILE_NAMES.has(entryName.toLowerCase())) {
        return true;
    }

    return isSamePath(sourcePath, runContext.outputRootDir)
        || isSamePath(sourcePath, runContext.reportRootDir)
        || isSamePath(sourcePath, runContext.tmpRootDir);
}

function ensureBuildDirectories(runContext: RunContext): void {
    try {
        ensureDirectory(runContext.outputRootDir);

        if (fs.existsSync(runContext.buildDir)) {
            throw new ResultCollisionError(`Output directory already exists: ${runContext.buildDir}`);
        }

        ensureDirectory(runContext.buildDir);
        ensureDirectory(runContext.buildModsDir);
    } catch (error) {
        if (error instanceof ResultCollisionError) {
            throw error;
        }

        throw new OutputDirectoryError(`Failed to prepare output directory: ${runContext.buildDir}`, { cause: error });
    }
}

function copyInstanceSkeleton(runContext: RunContext, record: RecordEvent): void {
    if (isSamePath(runContext.instancePath, runContext.modsPath)) {
        record('info', 'build', 'Skipping instance skeleton copy because input points directly to mods/');
        return;
    }

    const entries = fs.readdirSync(runContext.instancePath, { withFileTypes: true });

    for (const entry of entries) {
        const sourcePath = path.join(runContext.instancePath, entry.name);

        if (shouldSkipInstanceEntry(sourcePath, entry.name, runContext)) {
            continue;
        }

        const destinationPath = path.join(runContext.buildDir, entry.name);

        try {
            fs.cpSync(sourcePath, destinationPath, {
                recursive: true,
                force: false,
                errorOnExist: true
            });
            record('info', 'build', `Copied instance entry: ${entry.name}`);
        } catch (error) {
            throw new FileCopyError(`Failed to copy instance entry: ${entry.name}`, { cause: error });
        }
    }
}

function copyKeptFile(sourcePath: string, destinationPath: string): void {
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

function collectDecisions(
    modsPath: string,
    classificationContext: ClassificationContextLike,
    runContext: RunContext,
    record: RecordEvent = (_level, _kind, _message) => {},
    progressReporter: BuildProgressReporter = createNoopProgressReporter(),
    jarFiles: string[] | null = null
): {
    jarFiles: string[];
    decisions: PipelineDecision[];
} {
    const effectiveJarFiles = Array.isArray(jarFiles) ? jarFiles : listJarFiles(modsPath);
    const decisions: PipelineDecision[] = [];
    const total = effectiveJarFiles.length;

    for (const [index, fileName] of effectiveJarFiles.entries()) {
        const decision = classifyModFile({
            fileName,
            sourcePath: path.join(modsPath, fileName),
            classificationContext,
            runContext,
            record
        });

        decisions.push(decision);
        progressReporter.onModParsed({
            fileName,
            index: index + 1,
            total,
            descriptor: decision.descriptor,
            classification: decision.classification
        });
    }

    return {
        jarFiles: effectiveJarFiles,
        decisions
    };
}

function reclassifyDecisions({
    decisions,
    classificationContext,
    runContext,
    record = () => {}
}: {
    decisions: PipelineDecision[];
    classificationContext: ClassificationContextLike;
    runContext: RunContext;
    record?: RecordEvent;
}): PipelineDecision[] {
    return decisions.map((decision) => {
        if (!decision.descriptor) {
            return createFileDecision({
                fileName: decision.fileName,
                sourcePath: decision.sourcePath,
                descriptor: null,
                classification: null
            }) as PipelineDecision;
        }

        const classification = classifyDescriptor({
            descriptor: decision.descriptor,
            classificationContext: classificationContext as ClassificationContext,
            runContext,
            record
        });

        return createFileDecision({
            fileName: decision.fileName,
            sourcePath: decision.sourcePath,
            descriptor: decision.descriptor,
            classification
        }) as PipelineDecision;
    });
}

function applyBuildActions({
    decisions,
    runContext,
    record,
    progressReporter = createNoopProgressReporter()
}: {
    decisions: PipelineDecision[];
    runContext: RunContext;
    record: RecordEvent;
    progressReporter?: BuildProgressReporter;
}): PipelineDecision[] {
    const finalized: PipelineDecision[] = [];
    const total = decisions.length;

    if (!runContext.dryRun) {
        ensureBuildDirectories(runContext);
        copyInstanceSkeleton(runContext, record);
    }

    for (const [index, decision] of decisions.entries()) {
        if (decision.decision === 'exclude') {
            const excludedDecision = finalizeDecision(decision, {
                actionStatus: runContext.dryRun ? 'would-exclude' : 'excluded'
            });
            const excludedMessage = `${runContext.dryRun ? 'Would exclude' : 'Excluded'}: ${decision.fileName}`;

            record('info', runContext.dryRun ? 'dry-run' : 'build', excludedMessage);
            finalized.push(excludedDecision);
            progressReporter.onBuildActionCompleted({
                ...excludedDecision,
                index: index + 1,
                total
            });
            continue;
        }

        const destinationPath = path.join(runContext.buildModsDir, decision.fileName);

        if (runContext.dryRun) {
            record('info', 'dry-run', `Would copy: ${decision.fileName}`);
            const dryRunDecision = finalizeDecision(decision, {
                actionStatus: 'would-copy',
                destinationPath
            });
            finalized.push(dryRunDecision);
            progressReporter.onBuildActionCompleted({
                ...dryRunDecision,
                index: index + 1,
                total
            });
            continue;
        }

        try {
            copyKeptFile(decision.sourcePath, destinationPath);
            record('success', 'build', `Copied: ${decision.fileName}`);
            const copiedDecision = finalizeDecision(decision, {
                actionStatus: 'copied',
                destinationPath
            });
            finalized.push(copiedDecision);
            progressReporter.onBuildActionCompleted({
                ...copiedDecision,
                index: index + 1,
                total
            });
        } catch (error) {
            record('error', 'build', getErrorMessage(error));
            const failedDecision = finalizeDecision(decision, {
                actionStatus: 'error',
                destinationPath,
                error: {
                    code: getErrorCode(error, 'BUILD_ACTION_ERROR'),
                    message: getErrorMessage(error)
                }
            });
            finalized.push(failedDecision);
            progressReporter.onBuildActionCompleted({
                ...failedDecision,
                index: index + 1,
                total
            });
        }
    }

    return finalized;
}

function buildStats(decisions: PipelineDecision[]): RunReport['stats'] {
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

function collectReportIssues(decisions: PipelineDecision[]): {
    warnings: ReportIssue[];
    errors: ReportIssue[];
} {
    const warnings: ReportIssue[] = [];
    const errors: ReportIssue[] = [];

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

function createEmptyDependencyGraph(mode: RunContext['dependencyValidationMode'], error: ValidationError | null = null) {
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
            rolePropagations: 0,
            roleKeepConstraints: 0,
            roleRemoveSignals: 0,
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
        errors: error ? [error] : ([] as ValidationError[])
    };
}

function runDependencyStage({
    decisions,
    runContext,
    record
}: {
    decisions: PipelineDecision[];
    runContext: RunContext;
    record: RecordEvent;
}) {
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
            code: getErrorCode(error, 'DEPENDENCY_GRAPH_ERROR'),
            message: getErrorMessage(error)
        };

        record('error', 'graph-error', `Dependency graph analysis failed: ${getErrorMessage(error)}`);

        return {
            decisions,
            dependencyGraph: createEmptyDependencyGraph(runContext.dependencyValidationMode, serializedError)
        };
    }
}

function createEmptyArbiterReport(profile: RunContext['arbiterProfile'], error: ValidationError | null = null) {
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
        errors: error ? [error] : ([] as ValidationError[])
    };
}

function createEmptyDeepCheckReport(mode: RunContext['deepCheckMode'], error: ValidationError | null = null) {
    return {
        status: error ? 'error' : 'skipped',
        mode,
        summary: createEmptyDeepCheckSummary(mode),
        errors: error ? [error] : ([] as ValidationError[])
    };
}

function createEmptyValidation(mode: RunContext['validationMode'], error: ValidationError | null = null): ValidationResult {
    return createEmptyValidationReport(mode, {
        status: error ? 'error' : 'skipped',
        skipReason: error ? null : 'Validation stage was not run',
        errors: error ? [error] : []
    });
}

function runArbiterStage({
    decisions,
    runContext,
    record
}: {
    decisions: PipelineDecision[];
    runContext: RunContext;
    record: RecordEvent;
}) {
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
            code: getErrorCode(error, 'ARBITER_STAGE_ERROR'),
            message: getErrorMessage(error)
        };

        record('error', 'arbiter-error', `Arbiter failed: ${getErrorMessage(error)}`);

        return {
            decisions,
            arbiter: createEmptyArbiterReport(runContext.arbiterProfile, serializedError)
        };
    }
}

function runDeepCheckStage({
    decisions,
    runContext,
    record
}: {
    decisions: PipelineDecision[];
    runContext: RunContext;
    record: RecordEvent;
}) {
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
            code: getErrorCode(error, 'DEEP_CHECK_STAGE_ERROR'),
            message: getErrorMessage(error)
        };

        record('error', 'deep-check-error', `Deep-check stage failed: ${getErrorMessage(error)}`);

        return {
            decisions,
            deepCheck: createEmptyDeepCheckReport(runContext.deepCheckMode, serializedError)
        };
    }
}

async function runBuildPipeline({
    modsPath,
    blockList = [],
    classificationContext = null,
    runContext,
    logger,
    progressReporter = createNoopProgressReporter()
}: {
    modsPath: string;
    blockList?: string[];
    classificationContext?: ClassificationContextLike | null;
    runContext: RunContext;
    logger?: PipelineLogger | null;
    progressReporter?: BuildProgressReporter;
}) {
    const { runInitialCandidateIteration } = require('../convergence/iteration-engine');
    const result = await runInitialCandidateIteration({
        modsPath,
        blockList,
        classificationContext,
        runContext,
        logger,
        progressReporter
    });

    return result.report;
}

module.exports = {
    applyBuildActions,
    buildStats,
    collectDecisions,
    collectReportIssues,
    createEventCollector,
    createNoopProgressReporter,
    createEmptyValidation,
    reclassifyDecisions,
    runArbiterStage,
    runDeepCheckStage,
    runDependencyStage,
    runBuildPipeline
};
