const fs = require('node:fs');

const { ensureDirectory } = require('../io/history');
const { ReportWriteError } = require('../core/errors');

import type { RunReport, ReportEvent } from '../types/report';
import type { RunContext } from '../types/run';

interface ReportFiles {
    reportDir: string;
    jsonReportPath: string;
    runMetadataPath: string;
    summaryPath: string;
    eventsLogPath: string;
}

function createSummary(report: RunReport): string {
    const lines = [
        '# Run Summary',
        '',
        `- Run ID: ${report.run.runId}`,
        `- Mode: ${report.run.mode}`,
        `- Dry run: ${report.run.dryRun ? 'yes' : 'no'}`,
        `- Input: ${report.run.inputPath}`,
        `- Instance dir: ${report.run.instancePath}`,
        `- Build dir: ${report.run.buildDir}`,
        `- Report dir: ${report.run.reportDir}`,
        `- Engines: ${Array.isArray(report.run.enabledEngines) ? report.run.enabledEngines.join(', ') : 'n/a'}`,
        '',
        '## Registry',
        '',
        `- Mode: ${report.registry ? report.registry.mode : (report.run.registryMode || 'n/a')}`,
        `- Source: ${report.registry ? report.registry.sourceDescription : 'n/a'}`,
        `- Registry version: ${report.registry ? report.registry.registryVersion : 'n/a'}`,
        `- Schema version: ${report.registry ? report.registry.schemaVersion : 'n/a'}`,
        `- Refresh attempted: ${report.registry ? (report.registry.refreshAttempted ? 'yes' : 'no') : 'n/a'}`,
        `- Refresh succeeded: ${report.registry ? (report.registry.refreshSucceeded ? 'yes' : 'no') : 'n/a'}`,
        `- Used cache: ${report.registry ? (report.registry.usedCache ? 'yes' : 'no') : 'n/a'}`,
        `- Used embedded fallback: ${report.registry ? (report.registry.usedEmbeddedFallback ? 'yes' : 'no') : 'n/a'}`,
        `- Used local overrides: ${report.registry ? (report.registry.usedLocalOverrides ? 'yes' : 'no') : 'n/a'}`,
        `- Effective rules: ${report.registry ? report.registry.effectiveRuleCount : 0}`,
        '',
        '## Stats',
        '',
        `- Total .jar files: ${report.stats.totalJarFiles}`,
        `- Kept: ${report.stats.kept}`,
        `- Excluded: ${report.stats.excluded}`,
        `- Copied: ${report.stats.copied}`,
        `- Would copy: ${report.stats.wouldCopy}`,
        `- Would exclude: ${report.stats.wouldExclude}`,
        `- Errors: ${report.stats.errors}`,
        '',
        '## Parsing',
        '',
        `- Fabric: ${report.parsing.loaders.fabric}`,
        `- Quilt: ${report.parsing.loaders.quilt}`,
        `- Forge: ${report.parsing.loaders.forge}`,
        `- NeoForge: ${report.parsing.loaders.neoforge}`,
        `- Unknown: ${report.parsing.loaders.unknown}`,
        `- Files with warnings: ${report.parsing.filesWithWarnings}`,
        `- Files with errors: ${report.parsing.filesWithErrors}`,
        '',
        '## Classification',
        '',
        `- Final keep: ${report.classification.finalDecisions.keep}`,
        `- Final remove: ${report.classification.finalDecisions.remove}`,
        `- Conflicts: ${report.classification.conflicts}`,
        `- Conservative fallback decisions: ${report.classification.fallbackFinalDecisions}`,
        `- Files with engine errors: ${report.classification.filesWithEngineErrors}`,
        `- Client UI roles: ${report.classification.roleTypes ? report.classification.roleTypes['client-ui'] : 0}`,
        `- Client visual roles: ${report.classification.roleTypes ? report.classification.roleTypes['client-visual'] : 0}`,
        `- Client QoL roles: ${report.classification.roleTypes ? report.classification.roleTypes['client-qol'] : 0}`,
        `- Client library roles: ${report.classification.roleTypes ? report.classification.roleTypes['client-library'] : 0}`,
        `- Common library roles: ${report.classification.roleTypes ? report.classification.roleTypes['common-library'] : 0}`,
        `- Common gameplay roles: ${report.classification.roleTypes ? report.classification.roleTypes['common-gameplay'] : 0}`,
        `- Common optimization roles: ${report.classification.roleTypes ? report.classification.roleTypes['common-optimization'] : 0}`,
        `- Compat client roles: ${report.classification.roleTypes ? report.classification.roleTypes['compat-client'] : 0}`,
        '',
        '## Dependency Graph',
        '',
        `- Status: ${report.dependencyGraph ? report.dependencyGraph.status : 'n/a'}`,
        `- Mode: ${report.run.dependencyValidationMode || 'n/a'}`,
        `- Nodes: ${report.dependencyGraph ? report.dependencyGraph.summary.totalNodes : 0}`,
        `- Edges: ${report.dependencyGraph ? report.dependencyGraph.summary.totalEdges : 0}`,
        `- Missing required: ${report.dependencyGraph ? report.dependencyGraph.summary.missingRequired : 0}`,
        `- Missing optional: ${report.dependencyGraph ? report.dependencyGraph.summary.missingOptional : 0}`,
        `- Preserved by dependency: ${report.dependencyGraph ? report.dependencyGraph.summary.preservedByDependency : 0}`,
        `- Role propagations: ${report.dependencyGraph ? report.dependencyGraph.summary.rolePropagations : 0}`,
        `- Role keep constraints: ${report.dependencyGraph ? report.dependencyGraph.summary.roleKeepConstraints : 0}`,
        `- Role remove signals: ${report.dependencyGraph ? report.dependencyGraph.summary.roleRemoveSignals : 0}`,
        `- Ambiguous providers: ${report.dependencyGraph ? report.dependencyGraph.summary.ambiguousProviders : 0}`,
        `- Incompatibilities: ${report.dependencyGraph ? report.dependencyGraph.summary.incompatibilities : 0}`,
        `- Graph errors: ${report.dependencyGraph ? report.dependencyGraph.summary.graphErrors : 0}`,
        '',
        '## Arbiter',
        '',
        `- Status: ${report.arbiter ? report.arbiter.status : 'n/a'}`,
        `- Profile: ${report.run.arbiterProfile || 'n/a'}`,
        `- Final keep: ${report.arbiter ? report.arbiter.summary.finalDecisions.keep : 0}`,
        `- Final remove: ${report.arbiter ? report.arbiter.summary.finalDecisions.remove : 0}`,
        `- Final review: ${report.arbiter ? report.arbiter.summary.finalDecisions.review : 0}`,
        `- High confidence: ${report.arbiter ? report.arbiter.summary.confidence.high : 0}`,
        `- Medium confidence: ${report.arbiter ? report.arbiter.summary.confidence.medium : 0}`,
        `- Low confidence: ${report.arbiter ? report.arbiter.summary.confidence.low : 0}`,
        `- Deep-check recommended: ${report.arbiter ? report.arbiter.summary.requiresDeepCheck : 0}`,
        `- Review kept in build: ${report.arbiter ? report.arbiter.summary.reviewKeptInBuild : 0}`,
        `- Review excluded in build: ${report.arbiter ? report.arbiter.summary.reviewExcludedInBuild : 0}`,
        `- Profile-driven adjustments: ${report.arbiter ? report.arbiter.summary.profileDrivenAdjustments : 0}`,
        '',
        '## Deep Check',
        '',
        `- Status: ${report.deepCheck ? report.deepCheck.status : 'n/a'}`,
        `- Mode: ${report.run.deepCheckMode || 'n/a'}`,
        `- Triggered: ${report.deepCheck ? report.deepCheck.summary.triggered : 0}`,
        `- Skipped: ${report.deepCheck ? report.deepCheck.summary.skipped : 0}`,
        `- Resolved: ${report.deepCheck ? report.deepCheck.summary.resolved : 0}`,
        `- Unresolved: ${report.deepCheck ? report.deepCheck.summary.unresolved : 0}`,
        `- Failed: ${report.deepCheck ? report.deepCheck.summary.failed : 0}`,
        `- Decision changes: ${report.deepCheck ? report.deepCheck.summary.decisionChanged : 0}`,
        '',
        '## Probe',
        '',
        `- Status: ${report.probe ? report.probe.status : 'n/a'}`,
        `- Mode: ${report.run.probeMode || 'n/a'}`,
        `- Knowledge path: ${report.run.probeKnowledgePath || 'n/a'}`,
        `- Planned: ${report.probe ? report.probe.planned : 0}`,
        `- Attempted: ${report.probe ? report.probe.attempted : 0}`,
        `- Reused knowledge: ${report.probe ? report.probe.reusedKnowledge : 0}`,
        `- Stored knowledge: ${report.probe ? report.probe.storedKnowledge : 0}`,
        `- Resolved to keep: ${report.probe ? report.probe.resolvedToKeep : 0}`,
        `- Resolved to remove: ${report.probe ? report.probe.resolvedToRemove : 0}`,
        `- Inconclusive: ${report.probe ? report.probe.inconclusive : 0}`,
        `- Skip reason: ${report.probe ? (report.probe.skipReason || 'n/a') : 'n/a'}`,
        '',
        '## Manual Review',
        '',
        `- Overrides file: ${report.manualReview ? (report.manualReview.overridesPath || 'n/a') : 'n/a'}`,
        `- Saved entries: ${report.manualReview ? report.manualReview.totalEntries : 0}`,
        `- Applied overrides: ${report.manualReview ? report.manualReview.appliedOverrides : 0}`,
        `- Forced keep: ${report.manualReview ? report.manualReview.kept : 0}`,
        `- Forced exclude: ${report.manualReview ? report.manualReview.excluded : 0}`,
        '',
        '## Validation',
        '',
        `- Status: ${report.validation ? report.validation.status : 'n/a'}`,
        `- Mode: ${report.run.validationMode || 'n/a'}`,
        `- Attempted: ${report.validation ? (report.validation.runAttempted ? 'yes' : 'no') : 'n/a'}`,
        `- Entrypoint: ${report.validation && report.validation.entrypoint ? report.validation.entrypoint.originalPath : 'n/a'}`,
        `- Duration (ms): ${report.validation ? report.validation.durationMs : 0}`,
        `- Success markers: ${report.validation ? report.validation.summary.successMarkers : 0}`,
        `- Failure markers: ${report.validation ? report.validation.summary.failureMarkers : 0}`,
        `- Issues: ${report.validation ? report.validation.summary.totalIssues : 0}`,
        `- Suspected false removals: ${report.validation ? report.validation.summary.suspectedFalseRemovals : 0}`,
        `- Linked issues: ${report.validation ? report.validation.summary.linkedIssues : 0}`,
        `- Skip reason: ${report.validation ? (report.validation.skipReason || 'n/a') : 'n/a'}`,
        '',
        '## Report Issues',
        '',
        `- Aggregated warnings: ${report.warnings.length}`,
        `- Aggregated errors: ${report.errors.length}`,
        '',
        '## Result',
        ''
    ];

    if (report.run.dryRun) {
        lines.push('- Build output was not created because dry-run is enabled.');
    } else {
        lines.push(`- Build output created at: ${report.run.buildModsDir}`);
    }

    if (report.errors.length > 0) {
        lines.push(`- Build completed with ${report.errors.length} aggregated errors.`);
    } else {
        lines.push('- Build completed without aggregated errors.');
    }

    return `${lines.join('\n')}\n`;
}

function writeJson(filePath: string, data: unknown): void {
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function writeText(filePath: string, content: string): void {
    fs.writeFileSync(filePath, content, 'utf8');
}

function createEventsLog(events: ReportEvent[]): string {
    return `${events
        .map((event) => `[${event.timestamp}] ${event.level.toUpperCase()} [${event.kind.toUpperCase()}] ${event.message}`)
        .join('\n')}\n`;
}

function writeRunReports(runContext: RunContext, report: RunReport): ReportFiles {
    try {
        ensureDirectory(runContext.reportRootDir);
        ensureDirectory(runContext.reportDir);

        writeJson(runContext.runMetadataPath, report.run);
        writeJson(runContext.jsonReportPath, report);
        writeText(runContext.summaryPath, createSummary(report));
        writeText(runContext.eventsLogPath, createEventsLog(report.events));

        return {
            reportDir: runContext.reportDir,
            jsonReportPath: runContext.jsonReportPath,
            runMetadataPath: runContext.runMetadataPath,
            summaryPath: runContext.summaryPath,
            eventsLogPath: runContext.eventsLogPath
        };
    } catch (error) {
        throw new ReportWriteError(`Не удалось записать отчёт запуска: ${runContext.reportDir}`, { cause: error });
    }
}

module.exports = {
    createSummary,
    writeRunReports
};
