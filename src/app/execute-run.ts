const { runConvergenceLoop } = require('../convergence/orchestrator');

import type { BuildProgressReporter, ClassificationContextLike, PreparedRun } from '../types/app';
import type { RunReport } from '../types/report';
import type { RunContext } from '../types/run';

interface ExecuteRunParams {
    modsPath: string;
    classificationContext: ClassificationContextLike;
    runContext: RunContext;
    runLogger: PreparedRun['runLogger'];
    progressReporter?: BuildProgressReporter | null;
}

async function executeRun({
    modsPath,
    classificationContext,
    runContext,
    runLogger,
    progressReporter = null
}: ExecuteRunParams): Promise<RunReport> {
    return runConvergenceLoop({
        modsPath,
        classificationContext,
        runContext,
        logger: runLogger,
        progressReporter
    }) as Promise<RunReport>;
}

module.exports = {
    executeRun
};
