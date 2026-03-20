const path = require('node:path');

const { parseCliArgs, printHelp } = require('../cli/args');
const { executeRun } = require('../app/execute-run');
const { finalizeRun } = require('../app/finalize-run');
const { prepareRun } = require('../app/prepare-run');
const { createRuntimeConfig } = require('../config/runtime-config');
const { RunConfigurationError, UserInputError } = require('../core/errors');

import type { RuntimeConfig } from '../types/config';
import type { RegistryRuntimeState } from '../types/registry';
import type { RunReport } from '../types/report';
import type { RunContext } from '../types/run';
import { createBackendEventEmitter } from './event-emitter';
import type { BackendEventEmitter } from './event-emitter';
import { BACKEND_EVENT_TYPES } from './event-types';
import { createNdjsonWriter } from './ndjson-writer';
import { createBuildProgressReporter } from './progress-reporter';

function createNoopLogger() {
    const logger = {
        canLog() {
            return false;
        },
        paint(text: string) {
            return text;
        },
        withContext() {
            return logger;
        }
    } as Record<string, unknown>;

    const noopMethods = [
        'raw',
        'event',
        'debug',
        'info',
        'analysis',
        'discovery',
        'jar',
        'parse',
        'parseWarn',
        'parseError',
        'engine',
        'engineDecision',
        'engineWarning',
        'engineError',
        'engineConflict',
        'classification',
        'graph',
        'graphWarn',
        'graphError',
        'dependency',
        'dependencyPreserve',
        'registry',
        'registryWarn',
        'registryCache',
        'registryUpdate',
        'registryError',
        'arbiter',
        'arbiterWarn',
        'arbiterReview',
        'arbiterError',
        'deepCheck',
        'deepCheckWarn',
        'deepCheckReview',
        'deepCheckError',
        'validation',
        'validationWarn',
        'validationError',
        'validationSkip',
        'decision',
        'buildAction',
        'dryRunAction',
        'report',
        'hint',
        'warn',
        'success',
        'error'
    ];

    for (const methodName of noopMethods) {
        logger[methodName] = () => {};
    }

    return logger;
}

function createHelpLogger() {
    return {
        raw(message = '') {
            console.log(message);
        },
        paint(text: string) {
            return text;
        },
        withContext() {
            return this;
        }
    };
}

interface ReportFiles {
    reportDir: string;
    jsonReportPath: string;
    runMetadataPath: string;
    summaryPath: string;
    eventsLogPath: string;
    recipePath: string;
    candidatesPath: string;
}

interface FinalizedApplicationRun {
    report: RunReport;
    reportFiles: ReportFiles;
    runContext: RunContext;
}

interface HeadlessRunParams {
    config: RuntimeConfig;
    inputPath: string;
    emitter: BackendEventEmitter;
    logger?: ReturnType<typeof createNoopLogger>;
}

function getCurrentCandidate(report: RunReport) {
    if (!report.candidateTrace?.candidates?.length) {
        return null;
    }

    return report.candidateTrace.candidates.find((candidate) => candidate.candidateId === report.candidateTrace?.currentCandidateId)
        || report.candidateTrace.candidates[report.candidateTrace.candidates.length - 1]
        || null;
}

function emitReportEvents(emitter: BackendEventEmitter, result: FinalizedApplicationRun) {
    const { report, reportFiles, runContext } = result;
    const runId = runContext.runId;
    const currentCandidate = getCurrentCandidate(report);

    emitter.emit(BACKEND_EVENT_TYPES.classificationCompleted, {
        finalDecisions: report.classification?.finalDecisions || null,
        conflicts: report.classification?.conflicts || 0,
        fallbackFinalDecisions: report.classification?.fallbackFinalDecisions || 0
    }, runId);

    if (report.dependencyGraph) {
        emitter.emit(BACKEND_EVENT_TYPES.dependencyAnalysisCompleted, {
            status: report.dependencyGraph.status,
            summary: report.dependencyGraph.summary
        }, runId);
    }

    if (report.arbiter) {
        emitter.emit(BACKEND_EVENT_TYPES.arbiterReviewFound, {
            reviewCount: report.arbiter.summary.finalDecisions.review,
            confidence: report.arbiter.summary.confidence
        }, runId);
    }

    if (report.deepCheck) {
        emitter.emit(BACKEND_EVENT_TYPES.deepCheckCompleted, {
            status: report.deepCheck.status,
            summary: report.deepCheck.summary
        }, runId);
    }

    if (report.validation) {
        emitter.emit(BACKEND_EVENT_TYPES.validationCompleted, {
            status: report.validation.status,
            summary: report.validation.summary,
            skipReason: report.validation.skipReason || null
        }, runId);
    }

    emitter.emit(BACKEND_EVENT_TYPES.reportWritten, {
        reportDir: reportFiles.reportDir,
        jsonReportPath: reportFiles.jsonReportPath,
        summaryPath: reportFiles.summaryPath,
        eventsLogPath: reportFiles.eventsLogPath,
        recipePath: reportFiles.recipePath,
        candidatesPath: reportFiles.candidatesPath,
        terminalOutcomeId: report.terminalOutcome?.id || null,
        terminalOutcomeExplanation: report.terminalOutcome?.explanation || null,
        currentCandidateId: currentCandidate?.candidateId || null,
        currentIteration: typeof currentCandidate?.iteration === 'number' ? currentCandidate.iteration : null,
        candidateCount: report.candidateTrace?.candidates.length || 0
    }, runId);

    emitter.emit(BACKEND_EVENT_TYPES.runFinished, {
        mode: runContext.mode,
        dryRun: runContext.dryRun,
        buildDir: runContext.buildDir,
        buildModsDir: runContext.buildModsDir,
        reportDir: reportFiles.reportDir,
        kept: report.stats.kept,
        excluded: report.stats.excluded,
        copied: report.stats.copied,
        wouldCopy: report.stats.wouldCopy,
        wouldExclude: report.stats.wouldExclude,
        errors: report.stats.errors,
        terminalOutcomeId: report.terminalOutcome?.id || null,
        terminalOutcomeExplanation: report.terminalOutcome?.explanation || null,
        currentCandidateId: currentCandidate?.candidateId || null,
        currentIteration: typeof currentCandidate?.iteration === 'number' ? currentCandidate.iteration : null,
        candidateCount: report.candidateTrace?.candidates.length || 0
    }, runId);
}

async function runHeadlessApplication({
    config,
    inputPath,
    emitter,
    logger = createNoopLogger()
}: HeadlessRunParams): Promise<FinalizedApplicationRun> {
    const preparedRun = await prepareRun({
        config,
        inputPath,
        logger
    });
    const runId = preparedRun.runContext.runId;
    const progressReporter = createBuildProgressReporter({
        emitter,
        runId
    });

    emitter.emit(BACKEND_EVENT_TYPES.runStarted, {
        inputPath,
        mode: preparedRun.runContext.mode,
        dryRun: preparedRun.runContext.dryRun,
        buildDir: preparedRun.runContext.buildDir,
        reportDir: preparedRun.runContext.reportDir
    }, runId);

    emitter.emit(BACKEND_EVENT_TYPES.registryLoaded, {
        mode: preparedRun.registryRuntime.runtime.mode,
        source: preparedRun.registryRuntime.runtime.source,
        sourceDescription: preparedRun.registryRuntime.runtime.sourceDescription,
        registryVersion: preparedRun.registryRuntime.runtime.registryVersion
    }, runId);

    const report = await executeRun({
        ...preparedRun,
        progressReporter
    });
    const result = finalizeRun({
        report,
        runContext: preparedRun.runContext,
        runLogger: preparedRun.runLogger,
        registryRuntime: preparedRun.registryRuntime
    });

    emitReportEvents(emitter, result);
    return result;
}

async function main(argv = process.argv.slice(2)) {
    const writer = createNdjsonWriter();
    const emitter = createBackendEventEmitter({ writer });

    try {
        const scriptDir = path.resolve(__dirname, '..', '..');
        const cliOptions = parseCliArgs(argv);

        if (cliOptions.help) {
            printHelp(createHelpLogger());
            return;
        }

        const config = createRuntimeConfig({ scriptDir, cliOptions });
        const logger = createNoopLogger();

        if (!config.inputPath) {
            throw new UserInputError('Headless runner requires --input and does not support interactive mode');
        }

        await runHeadlessApplication({
            config,
            inputPath: config.inputPath,
            emitter,
            logger
        });
    } catch (error) {
        emitter.emit(BACKEND_EVENT_TYPES.runFailed, {
            message: error instanceof Error ? error.message : String(error),
            code: error && typeof error === 'object' && 'code' in error ? error.code : null,
            kind: error instanceof RunConfigurationError || error instanceof UserInputError ? 'configuration' : 'runtime'
        });
        process.exitCode = 1;
    }
}

module.exports = {
    createNoopLogger,
    emitReportEvents,
    main,
    runHeadlessApplication
};

if (require.main === module) {
    void main();
}
