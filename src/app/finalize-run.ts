const { createSyntheticCandidateTrace } = require('../convergence/candidate-state');
const { normalizeFailureAnalysis } = require('../failure/family');
const { resolveTerminalOutcomeContract } = require('../outcome/terminal-outcomes');
const { createPhase0ReportContract } = require('../policy/release-contract');
const { createMinimalRecipe } = require('../recipe/create-minimal-recipe');
const { writeRunReports } = require('../report/writer');

import type { FinalizedApplicationRun, PreparedRun, RegistryRuntimeBundle } from '../types/app';
import type { RunReport } from '../types/report';
import type { RunContext } from '../types/run';

interface ApplyRegistryRuntimeParams {
    report: RunReport;
    runContext: RunContext;
    registryRuntime: RegistryRuntimeBundle;
}

interface LogFinalizedRunParams {
    runContext: RunContext;
    report: RunReport;
    reportFiles: FinalizedApplicationRun['reportFiles'];
    runLogger: PreparedRun['runLogger'];
}

interface FinalizeRunParams {
    report: RunReport;
    runContext: RunContext;
    runLogger: PreparedRun['runLogger'];
    registryRuntime: RegistryRuntimeBundle;
}

function applyRegistryRuntimeToReport({ report, runContext, registryRuntime }: ApplyRegistryRuntimeParams): RunReport {
    report.registry = registryRuntime.runtime;
    report.run.registryMode = runContext.registryMode;
    report.run.registryManifestUrl = runContext.registryManifestUrl;
    report.run.registryBundleUrl = runContext.registryBundleUrl;
    report.run.registryCacheDir = runContext.registryCacheDir;
    report.run.localOverridesPath = runContext.localOverridesPath;
    report.run.registrySource = registryRuntime.runtime.source;
    report.run.registryVersion = registryRuntime.runtime.registryVersion;
    report.run.registryFilePath = registryRuntime.registry.filePath || null;
    report.events = [...registryRuntime.runtime.events, ...report.events];
    report.warnings.push(
        ...registryRuntime.runtime.warnings.map((message) => ({
            fileName: null,
            source: 'registry',
            code: 'REGISTRY_WARNING',
            message
        }))
    );
    report.errors.push(
        ...registryRuntime.runtime.errors.map((error) => ({
            fileName: null,
            source: 'registry',
            code: error.code,
            message: error.message,
            fatal: false
        }))
    );

    return report;
}

function applyPhase0ContractToReport({
    report,
    runContext
}: {
    report: RunReport;
    runContext: RunContext;
}): RunReport {
    const releaseContract = createPhase0ReportContract({
        runContext,
        report
    });

    report.releaseContract = releaseContract;
    report.run.supportBoundaryTier = releaseContract.supportBoundary.tier;
    report.run.supportBoundaryStatus = releaseContract.supportBoundary.status;
    report.run.supportBoundaryHasPendingChecks = releaseContract.supportBoundary.hasPendingChecks;
    report.run.primaryTerminalOutcomes = [...releaseContract.terminalOutcomes.primaryOutcomes];

    return report;
}

function applyPhase1ArtifactsToReport({
    report,
    runContext
}: {
    report: RunReport;
    runContext: RunContext;
}): RunReport {
    const candidateTrace = report.candidateTrace || createSyntheticCandidateTrace({
        runContext,
        report
    });
    const recipe = createMinimalRecipe({
        runContext,
        report,
        candidateTrace
    });

    report.candidateTrace = candidateTrace;
    report.recipe = recipe;

    return report;
}

function applyPhase3FailureAnalysisToReport({
    report
}: {
    report: RunReport;
}): RunReport {
    if (!report.releaseContract) {
        report.failureAnalysis = null;
        return report;
    }

    const failureAnalysis = normalizeFailureAnalysis({
        supportBoundary: report.releaseContract.supportBoundary,
        trustPolicy: report.releaseContract.trustPolicy,
        validation: report.validation || null
    });

    report.failureAnalysis = failureAnalysis;

    if (failureAnalysis?.kind === 'policy-blocked') {
        report.releaseContract = {
            ...report.releaseContract,
            terminalOutcomes: resolveTerminalOutcomeContract({
                supportBoundary: report.releaseContract.supportBoundary,
                policyBlocked: true
            })
        };
        report.run.primaryTerminalOutcomes = [...report.releaseContract.terminalOutcomes.primaryOutcomes];
    }

    return report;
}

function logFinalizedRun({ runContext, report, reportFiles, runLogger }: LogFinalizedRunParams): void {
    runLogger.report('Writing run artifacts...');
    runLogger.report(`Artifacts saved: ${reportFiles.reportDir}`);
    runLogger.raw('');
    runLogger.success(`Report JSON: ${reportFiles.jsonReportPath}`);
    runLogger.success(`Summary: ${reportFiles.summaryPath}`);
    runLogger.success(`Recipe: ${reportFiles.recipePath}`);
    runLogger.success(`Candidates: ${reportFiles.candidatesPath}`);
    runLogger.info(`Support boundary: ${report.releaseContract ? report.releaseContract.supportBoundary.status : 'n/a'}`);
    runLogger.info(`Primary terminal outcomes: ${report.releaseContract ? report.releaseContract.terminalOutcomes.primaryOutcomes.join(', ') : 'n/a'}`);
    runLogger.info(`Failure family: ${report.failureAnalysis ? (report.failureAnalysis.family || report.failureAnalysis.kind) : 'n/a'}`);
    runLogger.info(`Terminal outcome: ${report.terminalOutcome ? report.terminalOutcome.id : 'n/a'}`);
    runLogger.info(`Candidates: ${report.candidateTrace ? report.candidateTrace.candidates.length : 0}`);

    if (runContext.dryRun) {
        runLogger.warn('Dry-run completed: build output was not created.');
    } else {
        runLogger.success(`Build ready: ${report.run.buildModsDir}`);
    }
}

function finalizeRun({ report, runContext, runLogger, registryRuntime }: FinalizeRunParams): FinalizedApplicationRun {
    const effectiveRunContext = report.run as RunContext;
    const enrichedReport = applyPhase1ArtifactsToReport({
        report: applyPhase3FailureAnalysisToReport({
            report: applyPhase0ContractToReport({
                report: applyRegistryRuntimeToReport({
                    report,
                    runContext,
                    registryRuntime
                    }),
                runContext: effectiveRunContext
            })
        }),
        runContext: effectiveRunContext
    });
    const reportFiles = writeRunReports(runContext, enrichedReport);

    logFinalizedRun({
        runContext,
        report: enrichedReport,
        reportFiles,
        runLogger
    });

    return {
        report: enrichedReport,
        reportFiles,
        runContext
    };
}

module.exports = {
    applyPhase0ContractToReport,
    applyPhase1ArtifactsToReport,
    applyPhase3FailureAnalysisToReport,
    applyRegistryRuntimeToReport,
    finalizeRun,
    logFinalizedRun
};
