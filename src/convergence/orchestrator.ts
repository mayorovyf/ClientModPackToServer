const fs = require('node:fs');

const { applyPhase0ContractToReport, applyPhase3FailureAnalysisToReport } = require('../app/finalize-run');
const { attachTerminalOutcomeToCandidate, createCandidateState } = require('./candidate-state');
const { runInitialCandidateIteration } = require('./iteration-engine');
const { planNextCandidate } = require('./planner');
const { createDefaultSearchBudget, withConsumedProgress, withWallClockSnapshot } = require('./search-budget');

import type { ApplicationLogger, BuildProgressReporter, ClassificationContextLike } from '../types/app';
import type { ResolvedTerminalOutcome } from '../types/outcome';
import type { RunReport } from '../types/report';
import type { RunContext } from '../types/run';
import type { AppliedFix, CandidateState } from './types';

interface CandidateMutations {
    forcedExcludes: string[];
    forcedKeeps: string[];
    acceptEula: boolean;
}

interface CandidateExecutionState {
    candidateId: string;
    parentCandidateId: string | null;
    iteration: number;
    runContext: RunContext;
    mutations: CandidateMutations;
    appliedFixes: AppliedFix[];
    newlyAppliedFixes: AppliedFix[];
}

interface RunConvergenceLoopParams {
    modsPath: string;
    blockList?: string[];
    classificationContext?: ClassificationContextLike | null;
    runContext: RunContext;
    logger?: ApplicationLogger | null;
    progressReporter?: BuildProgressReporter | null;
}

function createTerminalOutcome({
    id,
    reasonCode,
    explanation
}: ResolvedTerminalOutcome): ResolvedTerminalOutcome {
    return {
        id,
        reasonCode,
        explanation
    };
}

function meetsSuccessContract(report: RunReport): boolean {
    return Boolean(
        report.validation
        && report.validation.runAttempted
        && report.validation.status === 'passed'
        && report.validation.successMarkers.length > 0
        && report.validation.errors.length === 0
    );
}

function removeCurrentBuildOutput(runContext: RunContext): void {
    if (!runContext.dryRun && fs.existsSync(runContext.buildDir)) {
        fs.rmSync(runContext.buildDir, { recursive: true, force: true });
    }
}

function enrichIterationReport({
    report,
    runContext
}: {
    report: RunReport;
    runContext: RunContext;
}): RunReport {
    return applyPhase3FailureAnalysisToReport({
        report: applyPhase0ContractToReport({
            report,
            runContext
        })
    });
}

function toCandidateTrace({
    currentCandidate,
    candidates,
    searchBudget
}: {
    currentCandidate: CandidateState;
    candidates: CandidateState[];
    searchBudget: ReturnType<typeof createDefaultSearchBudget>;
}) {
    return {
        currentCandidateId: currentCandidate.candidateId,
        candidates,
        fingerprintDigests: [...new Set(candidates.map((candidate) => candidate.fingerprint.digest))],
        searchBudget
    };
}

function withFinalCandidateOutcome({
    currentCandidate,
    candidates,
    terminalOutcome
}: {
    currentCandidate: CandidateState;
    candidates: CandidateState[];
    terminalOutcome: ResolvedTerminalOutcome;
}): CandidateState[] {
    return candidates.map((candidate) => (
        candidate.candidateId === currentCandidate.candidateId
            ? attachTerminalOutcomeToCandidate({
                candidate,
                terminalOutcome
            })
            : candidate
    ));
}

async function runConvergenceLoop({
    modsPath,
    blockList = [],
    classificationContext = null,
    runContext,
    logger = null,
    progressReporter = null
}: RunConvergenceLoopParams): Promise<RunReport> {
    const startedAtMs = Date.now();
    let searchBudget = createDefaultSearchBudget({
        runContext,
        candidateStates: 0
    });
    const candidates: CandidateState[] = [];
    const seenFailingStateDigests = new Set<string>();
    let execution: CandidateExecutionState = {
        candidateId: `${runContext.runId}:candidate-0`,
        parentCandidateId: null,
        iteration: 0,
        runContext,
        mutations: {
            forcedExcludes: [],
            forcedKeeps: [],
            acceptEula: false
        },
        appliedFixes: [],
        newlyAppliedFixes: []
    };

    while (true) {
        if (execution.iteration > 0) {
            removeCurrentBuildOutput(execution.runContext);
        }

        const iterationResult = await runInitialCandidateIteration({
            modsPath,
            blockList,
            classificationContext,
            runContext: execution.runContext,
            logger,
            progressReporter,
            candidateId: execution.candidateId,
            parentCandidateId: execution.parentCandidateId,
            iteration: execution.iteration,
            appliedFixes: execution.appliedFixes,
            mutations: execution.mutations
        });
        const report = enrichIterationReport({
            report: iterationResult.report,
            runContext: execution.runContext
        });
        const candidate = createCandidateState({
            runContext: execution.runContext,
            report,
            candidateId: execution.candidateId,
            parentCandidateId: execution.parentCandidateId,
            iteration: execution.iteration,
            appliedFixes: execution.appliedFixes
        });

        candidates.push(candidate);
        searchBudget = withConsumedProgress(searchBudget, {
            candidateStates: 1,
            retries: execution.iteration > 0 ? 1 : 0,
            guardedFixes: execution.newlyAppliedFixes.filter((fix) => fix.scope === 'guarded').length
        });
        searchBudget = withWallClockSnapshot(searchBudget, Date.now() - startedAtMs);

        let terminalOutcome: ResolvedTerminalOutcome | null = null;

        if (meetsSuccessContract(report)) {
            terminalOutcome = createTerminalOutcome({
                id: 'success',
                reasonCode: 'success-contract-met',
                explanation: 'The candidate reached the dedicated server success contract with a reliable ready marker.'
            });
        } else if (report.releaseContract?.supportBoundary.status === 'unsupported') {
            terminalOutcome = createTerminalOutcome({
                id: 'not-automatable-within-boundaries',
                reasonCode: 'outside-support-boundary',
                explanation: report.releaseContract.supportBoundary.summary
            });
        } else if (report.failureAnalysis?.kind === 'policy-blocked') {
            terminalOutcome = createTerminalOutcome({
                id: 'not-automatable-within-boundaries',
                reasonCode: 'policy-blocked',
                explanation: report.failureAnalysis.explanation
            });
        } else if (candidate.outcomeStatus !== 'passed' && seenFailingStateDigests.has(candidate.stateDigest)) {
            terminalOutcome = createTerminalOutcome({
                id: 'diagnosable-but-not-fixable',
                reasonCode: 'duplicate-failing-state',
                explanation: 'Convergence stopped because the next failing candidate repeated an already seen state.'
            });
        } else {
            seenFailingStateDigests.add(candidate.stateDigest);
        }

        if (!terminalOutcome && searchBudget.exhausted) {
            terminalOutcome = createTerminalOutcome({
                id: 'diagnosable-but-not-fixable',
                reasonCode: 'search-budget-exhausted',
                explanation: 'Convergence stopped because the bounded search budget was exhausted before reaching the success contract.'
            });
        }

        if (!terminalOutcome) {
            const nextPlan = planNextCandidate({
                candidate,
                report,
                runContext: execution.runContext,
                searchBudget,
                mutations: execution.mutations
            });

            if (!nextPlan) {
                terminalOutcome = createTerminalOutcome({
                    id: 'diagnosable-but-not-fixable',
                    reasonCode: 'no-safe-action-left',
                    explanation: report.failureAnalysis?.explanation
                        || 'The failure was diagnosed, but no additional safe action is available inside the current boundaries.'
                });
            } else {
                const nextAppliedFixes = nextPlan.appliedFixes;
                const newlyAppliedFixes = nextAppliedFixes.slice(candidate.appliedFixes.length);

                execution = {
                    candidateId: `${runContext.runId}:candidate-${candidate.iteration + 1}`,
                    parentCandidateId: candidate.candidateId,
                    iteration: candidate.iteration + 1,
                    runContext: nextPlan.runContext,
                    mutations: nextPlan.mutations,
                    appliedFixes: nextAppliedFixes,
                    newlyAppliedFixes
                };
            }
        }

        if (terminalOutcome) {
            const finalizedCandidates = withFinalCandidateOutcome({
                currentCandidate: candidate,
                candidates,
                terminalOutcome
            });
            const currentCandidate = finalizedCandidates[finalizedCandidates.length - 1] || candidate;

            report.terminalOutcome = terminalOutcome;
            report.candidateTrace = toCandidateTrace({
                currentCandidate,
                candidates: finalizedCandidates,
                searchBudget
            });
            report.events.push({
                timestamp: new Date().toISOString(),
                level: 'info',
                kind: 'convergence',
                message: `Terminal outcome ${terminalOutcome.id}: ${terminalOutcome.explanation}`
            });

            return report;
        }
    }
}

module.exports = {
    runConvergenceLoop
};
