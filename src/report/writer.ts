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
    recipePath: string;
    candidatesPath: string;
}

function createSummary(report: RunReport): string {
    const currentCandidate = report.candidateTrace?.candidates.find((candidate) => candidate.candidateId === report.candidateTrace?.currentCandidateId)
        || report.candidateTrace?.candidates[report.candidateTrace.candidates.length - 1]
        || null;
    const topologyPartitionCounts = (report.decisions || []).reduce((counts, decision) => {
        const partition = decision.topologyPartition || 'unresolved-artifact';

        counts[partition] = (counts[partition] || 0) + 1;
        return counts;
    }, {
        'target-runtime-artifact': 0,
        'connector-layer-artifact': 0,
        'topology-incompatible-artifact': 0,
        'unresolved-artifact': 0
    } as Record<string, number>);
    const lines = [
        '# Run Summary',
        '',
        `- Run ID: ${report.run.runId}`,
        `- Mode: ${report.run.mode}`,
        `- Dry run: ${report.run.dryRun ? 'yes' : 'no'}`,
        `- Input: ${report.run.inputPath}`,
        `- Instance dir: ${report.run.instancePath}`,
        `- Build dir: ${report.run.buildDir}`,
        `- Build mods dir: ${report.run.buildModsDir}`,
        `- Report dir: ${report.run.reportDir}`,
        `- Report JSON path: ${report.run.jsonReportPath}`,
        `- Summary path: ${report.run.summaryPath}`,
        `- Recipe path: ${report.run.recipePath}`,
        `- Candidates path: ${report.run.candidatesPath}`,
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
        '## Release Contract',
        '',
        `- Support boundary tier: ${report.releaseContract ? report.releaseContract.supportBoundary.tier : 'n/a'}`,
        `- Support boundary status: ${report.releaseContract ? report.releaseContract.supportBoundary.status : 'n/a'}`,
        `- Pending checks: ${report.releaseContract ? (report.releaseContract.supportBoundary.hasPendingChecks ? 'yes' : 'no') : 'n/a'}`,
        `- Runtime topology assessment: ${report.releaseContract ? report.releaseContract.supportBoundary.runtimeTopology.assessment : 'n/a'}`,
        `- Runtime topology id: ${report.releaseContract ? (report.releaseContract.supportBoundary.runtimeTopology.topologyId || 'n/a') : 'n/a'}`,
        `- Runtime topology class: ${report.releaseContract ? report.releaseContract.supportBoundary.runtimeTopology.topologyClass : 'n/a'}`,
        `- Runtime topology base loader: ${report.releaseContract ? (report.releaseContract.supportBoundary.runtimeTopology.baseLoader || 'n/a') : 'n/a'}`,
        `- Runtime topology connector layer: ${report.releaseContract ? (report.releaseContract.supportBoundary.runtimeTopology.connectorLayer || 'n/a') : 'n/a'}`,
        `- Runtime topology bridged ecosystem: ${report.releaseContract ? (report.releaseContract.supportBoundary.runtimeTopology.bridgedEcosystem || 'n/a') : 'n/a'}`,
        `- Support boundary summary: ${report.releaseContract ? report.releaseContract.supportBoundary.summary : 'n/a'}`,
        `- Primary terminal outcomes: ${report.releaseContract ? report.releaseContract.terminalOutcomes.primaryOutcomes.join(', ') : 'n/a'}`,
        `- Reserved terminal outcomes: ${report.releaseContract ? report.releaseContract.terminalOutcomes.reservedOutcomes.join(', ') : 'n/a'}`,
        `- Safe actions: ${report.releaseContract ? report.releaseContract.trustPolicy.safeByDefaultActions.length : 0}`,
        `- Guarded actions: ${report.releaseContract ? report.releaseContract.trustPolicy.guardedActions.length : 0}`,
        `- Manual-only actions: ${report.releaseContract ? report.releaseContract.trustPolicy.manualOnlyActions.length : 0}`,
        `- Forbidden actions: ${report.releaseContract ? report.releaseContract.trustPolicy.forbiddenActions.length : 0}`,
        `- Terminal outcome: ${report.terminalOutcome ? report.terminalOutcome.id : 'n/a'}`,
        `- Terminal explanation: ${report.terminalOutcome ? report.terminalOutcome.explanation : 'n/a'}`,
        '',
        '## Candidate Trace',
        '',
        `- Current candidate: ${report.candidateTrace ? (report.candidateTrace.currentCandidateId || 'n/a') : 'n/a'}`,
        `- Current iteration: ${currentCandidate ? currentCandidate.iteration : 'n/a'}`,
        `- Candidate count: ${report.candidateTrace ? report.candidateTrace.candidates.length : 0}`,
        `- Fingerprint digests: ${report.candidateTrace ? report.candidateTrace.fingerprintDigests.length : 0}`,
        `- Search budget max candidate states: ${report.candidateTrace ? report.candidateTrace.searchBudget.maxCandidateStates : 0}`,
        `- Search budget max retries: ${report.candidateTrace ? report.candidateTrace.searchBudget.maxRetries : 0}`,
        `- Search budget max guarded fixes: ${report.candidateTrace ? report.candidateTrace.searchBudget.maxGuardedFixes : 0}`,
        `- Search budget consumed candidate states: ${report.candidateTrace ? report.candidateTrace.searchBudget.consumedCandidateStates : 0}`,
        `- Search budget consumed retries: ${report.candidateTrace ? report.candidateTrace.searchBudget.consumedRetries : 0}`,
        `- Search budget consumed guarded fixes: ${report.candidateTrace ? report.candidateTrace.searchBudget.consumedGuardedFixes : 0}`,
        `- Search budget consumed wall-clock (ms): ${report.candidateTrace ? report.candidateTrace.searchBudget.consumedWallClockMs : 0}`,
        `- Search budget exhausted: ${report.candidateTrace ? (report.candidateTrace.searchBudget.exhausted ? 'yes' : 'no') : 'n/a'}`,
        '',
        '## Recipe',
        '',
        `- Schema version: ${report.recipe ? report.recipe.schemaVersion : 'n/a'}`,
        `- Selected runtime topology: ${report.recipe ? (report.recipe.selectedRuntimeTopologyId || 'n/a') : 'n/a'}`,
        `- Selected loader: ${report.recipe ? (report.recipe.selectedLoader || 'n/a') : 'n/a'}`,
        `- Selected core: ${report.recipe ? (report.recipe.selectedCore || 'n/a') : 'n/a'}`,
        `- Selected Java profile: ${report.recipe ? (report.recipe.selectedJavaProfile || 'n/a') : 'n/a'}`,
        `- Launch entrypoint kind: ${report.recipe ? (report.recipe.launchProfile.validationEntrypointKind || 'n/a') : 'n/a'}`,
        `- Keep decisions: ${report.recipe ? report.recipe.decisions.keep.length : 0}`,
        `- Remove decisions: ${report.recipe ? report.recipe.decisions.remove.length : 0}`,
        `- Add decisions: ${report.recipe ? report.recipe.decisions.add.length : 0}`,
        `- Artifact decisions: ${report.recipe ? report.recipe.artifactDecisions.length : 0}`,
        `- Applied fixes: ${report.recipe ? report.recipe.appliedFixes.length : 0}`,
        `- Recipe outcome status: ${report.recipe ? report.recipe.finalOutcome.status : 'n/a'}`,
        `- Recipe terminal outcome: ${report.recipe ? (report.recipe.finalOutcome.terminalOutcomeId || 'n/a') : 'n/a'}`,
        `- Recipe explanation: ${report.recipe ? report.recipe.finalOutcome.explanation : 'n/a'}`,
        '',
        '## Runtime Detection',
        '',
        `- Status: ${report.runtimeDetection ? report.runtimeDetection.status : 'n/a'}`,
        `- Source: ${report.runtimeDetection ? report.runtimeDetection.source : 'n/a'}`,
        `- Confidence: ${report.runtimeDetection ? report.runtimeDetection.confidence : 'n/a'}`,
        `- Loader: ${report.runtimeDetection ? (report.runtimeDetection.loader || 'n/a') : 'n/a'}`,
        `- Loader version: ${report.runtimeDetection ? (report.runtimeDetection.loaderVersion || 'n/a') : 'n/a'}`,
        `- Minecraft version: ${report.runtimeDetection ? (report.runtimeDetection.minecraftVersion || 'n/a') : 'n/a'}`,
        `- Supported server core: ${report.runtimeDetection ? (report.runtimeDetection.supportedServerCore || 'n/a') : 'n/a'}`,
        `- Warnings: ${report.runtimeDetection ? (report.runtimeDetection.warnings.join(' | ') || 'n/a') : 'n/a'}`,
        '',
        '## Server Core',
        '',
        `- Enabled by config: ${report.serverCoreInstall ? (report.serverCoreInstall.enabledByConfig ? 'yes' : 'no') : 'n/a'}`,
        `- Requested: ${report.serverCoreInstall ? (report.serverCoreInstall.requested ? 'yes' : 'no') : 'n/a'}`,
        `- Status: ${report.serverCoreInstall ? report.serverCoreInstall.status : 'n/a'}`,
        `- Core type: ${report.serverCoreInstall ? (report.serverCoreInstall.coreType || 'n/a') : 'n/a'}`,
        `- Minecraft version: ${report.serverCoreInstall ? (report.serverCoreInstall.minecraftVersion || 'n/a') : 'n/a'}`,
        `- Loader version: ${report.serverCoreInstall ? (report.serverCoreInstall.loaderVersion || 'n/a') : 'n/a'}`,
        `- Entrypoint: ${report.serverCoreInstall ? (report.serverCoreInstall.entrypointPath || 'n/a') : 'n/a'}`,
        `- Reason: ${report.serverCoreInstall ? (report.serverCoreInstall.reason || 'n/a') : 'n/a'}`,
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
        `- Target runtime artifacts: ${topologyPartitionCounts['target-runtime-artifact']}`,
        `- Connector-layer artifacts: ${topologyPartitionCounts['connector-layer-artifact']}`,
        `- Topology-incompatible artifacts: ${topologyPartitionCounts['topology-incompatible-artifact']}`,
        `- Unresolved artifacts: ${topologyPartitionCounts['unresolved-artifact']}`,
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
        '## Failure Analysis',
        '',
        `- Kind: ${report.failureAnalysis ? report.failureAnalysis.kind : 'n/a'}`,
        `- Family: ${report.failureAnalysis ? (report.failureAnalysis.family || 'n/a') : 'n/a'}`,
        `- Confidence: ${report.failureAnalysis ? report.failureAnalysis.confidence : 'n/a'}`,
        `- Explanation: ${report.failureAnalysis ? report.failureAnalysis.explanation : 'n/a'}`,
        `- Suspect mod ids: ${report.failureAnalysis ? report.failureAnalysis.suspectSet.modIds.join(', ') || 'n/a' : 'n/a'}`,
        `- Suspect files: ${report.failureAnalysis ? report.failureAnalysis.suspectSet.fileNames.join(', ') || 'n/a' : 'n/a'}`,
        `- Suspect jar hints: ${report.failureAnalysis ? report.failureAnalysis.suspectSet.jarHints.join(', ') || 'n/a' : 'n/a'}`,
        `- Allowed actions: ${report.failureAnalysis ? report.failureAnalysis.allowedActions.join(', ') || 'n/a' : 'n/a'}`,
        `- Blocked actions: ${report.failureAnalysis ? report.failureAnalysis.blockedActions.join(', ') || 'n/a' : 'n/a'}`,
        `- Blocked action reasons: ${report.failureAnalysis ? report.failureAnalysis.blockedActionReasons.join(' | ') || 'n/a' : 'n/a'}`,
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
        lines.push(`- Build output created at: ${report.run.buildDir}`);
    }

    if (report.errors.length > 0) {
        lines.push(`- Build completed with ${report.errors.length} aggregated errors.`);
    } else {
        lines.push('- Build completed without aggregated errors.');
    }

    if (report.terminalOutcome) {
        lines.push(`- Terminal outcome: ${report.terminalOutcome.id}.`);
        lines.push(`- Explanation: ${report.terminalOutcome.explanation}`);
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
        writeJson(runContext.recipePath, report.recipe || null);
        writeJson(runContext.candidatesPath, report.candidateTrace || null);
        writeText(runContext.summaryPath, createSummary(report));
        writeText(runContext.eventsLogPath, createEventsLog(report.events));

        return {
            reportDir: runContext.reportDir,
            jsonReportPath: runContext.jsonReportPath,
            runMetadataPath: runContext.runMetadataPath,
            summaryPath: runContext.summaryPath,
            eventsLogPath: runContext.eventsLogPath,
            recipePath: runContext.recipePath,
            candidatesPath: runContext.candidatesPath
        };
    } catch (error) {
        throw new ReportWriteError(`Не удалось записать отчёт запуска: ${runContext.reportDir}`, { cause: error });
    }
}

module.exports = {
    createSummary,
    writeRunReports
};
