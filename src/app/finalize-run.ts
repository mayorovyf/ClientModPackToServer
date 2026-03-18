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

function logFinalizedRun({ runContext, reportFiles, runLogger }: LogFinalizedRunParams): void {
    runLogger.report('Запись артефактов запуска...');
    runLogger.report(`Артефакты сохранены: ${reportFiles.reportDir}`);
    runLogger.raw('');
    runLogger.success(`Отчёт JSON: ${reportFiles.jsonReportPath}`);
    runLogger.success(`Summary: ${reportFiles.summaryPath}`);

    if (runContext.dryRun) {
        runLogger.warn('Dry-run завершён: build-папка не создавалась');
    } else {
        runLogger.success(`Сборка готова: ${runContext.buildModsDir}`);
    }
}

function finalizeRun({ report, runContext, runLogger, registryRuntime }: FinalizeRunParams): FinalizedApplicationRun {
    const enrichedReport = applyRegistryRuntimeToReport({
        report,
        runContext,
        registryRuntime
    });
    const reportFiles = writeRunReports(runContext, enrichedReport);

    logFinalizedRun({
        runContext,
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
    applyRegistryRuntimeToReport,
    finalizeRun,
    logFinalizedRun
};
