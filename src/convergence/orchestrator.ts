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
    const allowedJavaProfiles = report.releaseContract?.supportBoundary.runtimeTopology.matchedWhitelistEntry?.allowedJavaProfiles || [];

    return Boolean(
        report.validation
        && report.validation.runAttempted
        && report.validation.status === 'passed'
        && report.validation.successMarkers.length > 0
        && report.validation.joinability?.status === 'passed'
        && report.validation.errors.length === 0
        && (allowedJavaProfiles.length === 0 || allowedJavaProfiles.includes(report.run.javaProfile))
    );
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

function createSearchBudgetSnapshot(searchBudget: ReturnType<typeof createDefaultSearchBudget>) {
    return {
        consumedCandidateStates: searchBudget.consumedCandidateStates,
        consumedRetries: searchBudget.consumedRetries,
        consumedGuardedFixes: searchBudget.consumedGuardedFixes,
        consumedWallClockMs: searchBudget.consumedWallClockMs,
        exhausted: searchBudget.exhausted
    };
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
    let staticSnapshot: Awaited<ReturnType<typeof runInitialCandidateIteration>>['staticSnapshot'] = null;
    let realizedSnapshot: Awaited<ReturnType<typeof runInitialCandidateIteration>>['realizedSnapshot'] = null;
    let workspaceSession: Awaited<ReturnType<typeof runInitialCandidateIteration>>['workspaceSession'] = null;
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
        progressReporter?.onConvergenceCandidateStarted({
            candidateId: execution.candidateId,
            parentCandidateId: execution.parentCandidateId,
            iteration: execution.iteration,
            loopStage: 'candidate',
            appliedFixKinds: execution.appliedFixes.map((fix) => fix.kind),
            newlyAppliedFixKinds: execution.newlyAppliedFixes.map((fix) => fix.kind),
            candidateCount: candidates.length + 1,
            searchBudget: createSearchBudgetSnapshot(searchBudget)
        });

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
            newlyAppliedFixes: execution.newlyAppliedFixes,
            staticSnapshot,
            realizedSnapshot,
            workspaceSession,
            mutations: execution.mutations
        });
        staticSnapshot = iterationResult.staticSnapshot || staticSnapshot;
        realizedSnapshot = iterationResult.realizedSnapshot || realizedSnapshot;
        workspaceSession = iterationResult.workspaceSession || workspaceSession;
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
        progressReporter?.onConvergenceCandidateCompleted({
            candidateId: candidate.candidateId,
            parentCandidateId: candidate.parentCandidateId,
            iteration: candidate.iteration,
            loopStage: 'candidate-completed',
            failureFamily: candidate.failureFamily,
            outcomeStatus: candidate.outcomeStatus,
            stateDigest: candidate.stateDigest,
            appliedFixKinds: candidate.appliedFixes.map((fix: AppliedFix) => fix.kind),
            terminalOutcomeId: candidate.terminalOutcomeId,
            terminalOutcomeExplanation: candidate.shortExplanation,
            candidateCount: candidates.length,
            searchBudget: createSearchBudgetSnapshot(searchBudget)
        });

        let terminalOutcome: ResolvedTerminalOutcome | null = null;

        if (meetsSuccessContract(report)) {
            terminalOutcome = createTerminalOutcome({
                id: 'success',
                reasonCode: 'success-contract-met',
                explanation: 'The candidate reached the success contract with a reliable ready marker and deterministic joinability confirmation.'
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
                const nextCandidateId = `${runContext.runId}:candidate-${candidate.iteration + 1}`;

                progressReporter?.onConvergencePlanSelected({
                    candidateId: candidate.candidateId,
                    nextCandidateId,
                    iteration: candidate.iteration,
                    nextIteration: candidate.iteration + 1,
                    loopStage: 'planning',
                    failureFamily: candidate.failureFamily,
                    appliedFixKinds: nextAppliedFixes.map((fix: AppliedFix) => fix.kind),
                    newlyAppliedFixKinds: newlyAppliedFixes.map((fix: AppliedFix) => fix.kind),
                    candidateCount: candidates.length,
                    searchBudget: createSearchBudgetSnapshot(searchBudget)
                });

                execution = {
                    candidateId: nextCandidateId,
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
            progressReporter?.onConvergenceTerminalOutcome({
                candidateId: currentCandidate.candidateId,
                parentCandidateId: currentCandidate.parentCandidateId,
                iteration: currentCandidate.iteration,
                loopStage: 'terminal-outcome',
                failureFamily: currentCandidate.failureFamily,
                outcomeStatus: currentCandidate.outcomeStatus,
                stateDigest: currentCandidate.stateDigest,
                appliedFixKinds: currentCandidate.appliedFixes.map((fix: AppliedFix) => fix.kind),
                terminalOutcomeId: terminalOutcome.id,
                terminalOutcomeExplanation: terminalOutcome.explanation,
                reasonCode: terminalOutcome.reasonCode,
                candidateCount: finalizedCandidates.length,
                searchBudget: createSearchBudgetSnapshot(searchBudget)
            });

            return report;
        }
    }
}

module.exports = {
    runConvergenceLoop
};
