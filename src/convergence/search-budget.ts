import type { SearchBudget } from './types';
import type { RunContext } from '../types/run';

function createDefaultSearchBudget({
    runContext,
    candidateStates = 1,
    retries = 0,
    guardedFixes = 0,
    wallClockMs = 0
}: {
    runContext: RunContext;
    candidateStates?: number;
    retries?: number;
    guardedFixes?: number;
    wallClockMs?: number;
}): SearchBudget {
    const maxWallClockMs = Math.max(runContext.validationTimeoutMs * 3, runContext.probeTimeoutMs * 2, 60000);
    const consumedCandidateStates = Math.max(candidateStates, 0);
    const consumedRetries = Math.max(retries, 0);
    const consumedGuardedFixes = Math.max(guardedFixes, 0);
    const consumedWallClockMs = Math.max(wallClockMs, 0);

    return {
        maxCandidateStates: 8,
        maxRetries: 3,
        maxGuardedFixes: 2,
        maxWallClockMs,
        consumedCandidateStates,
        consumedRetries,
        consumedGuardedFixes,
        consumedWallClockMs,
        exhausted: consumedCandidateStates >= 8
            || consumedRetries >= 3
            || consumedGuardedFixes >= 2
            || consumedWallClockMs >= maxWallClockMs
    };
}

function withConsumedProgress(
    budget: SearchBudget,
    {
        candidateStates = 0,
        retries = 0,
        guardedFixes = 0,
        wallClockMs = 0
    }: {
        candidateStates?: number;
        retries?: number;
        guardedFixes?: number;
        wallClockMs?: number;
    }
): SearchBudget {
    const nextBudget = {
        ...budget,
        consumedCandidateStates: budget.consumedCandidateStates + Math.max(candidateStates, 0),
        consumedRetries: budget.consumedRetries + Math.max(retries, 0),
        consumedGuardedFixes: budget.consumedGuardedFixes + Math.max(guardedFixes, 0),
        consumedWallClockMs: budget.consumedWallClockMs + Math.max(wallClockMs, 0)
    };

    nextBudget.exhausted = nextBudget.consumedCandidateStates >= nextBudget.maxCandidateStates
        || nextBudget.consumedRetries >= nextBudget.maxRetries
        || nextBudget.consumedGuardedFixes >= nextBudget.maxGuardedFixes
        || nextBudget.consumedWallClockMs >= nextBudget.maxWallClockMs;

    return nextBudget;
}

function withWallClockSnapshot(budget: SearchBudget, wallClockMs: number): SearchBudget {
    const nextBudget = {
        ...budget,
        consumedWallClockMs: Math.max(wallClockMs, 0)
    };

    nextBudget.exhausted = nextBudget.consumedCandidateStates >= nextBudget.maxCandidateStates
        || nextBudget.consumedRetries >= nextBudget.maxRetries
        || nextBudget.consumedGuardedFixes >= nextBudget.maxGuardedFixes
        || nextBudget.consumedWallClockMs >= nextBudget.maxWallClockMs;

    return nextBudget;
}

module.exports = {
    createDefaultSearchBudget,
    withConsumedProgress,
    withWallClockSnapshot
};
