import type { SearchBudget } from './types';
import type { RunContext } from '../types/run';

function createDefaultSearchBudget({
    runContext,
    candidateStates = 1,
    guardedFixes = 0
}: {
    runContext: RunContext;
    candidateStates?: number;
    guardedFixes?: number;
}): SearchBudget {
    const maxWallClockMs = Math.max(runContext.validationTimeoutMs * 3, runContext.probeTimeoutMs * 2, 60000);
    const consumedCandidateStates = Math.max(candidateStates, 0);
    const consumedGuardedFixes = Math.max(guardedFixes, 0);

    return {
        maxCandidateStates: 8,
        maxRetries: 3,
        maxGuardedFixes: 2,
        maxWallClockMs,
        consumedCandidateStates,
        consumedRetries: 0,
        consumedGuardedFixes,
        consumedWallClockMs: 0,
        exhausted: false
    };
}

module.exports = {
    createDefaultSearchBudget
};
