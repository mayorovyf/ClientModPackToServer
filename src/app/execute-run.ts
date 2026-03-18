const { runBuildPipeline } = require('../build/builder');

import type { BuildProgressReporter, ClassificationContextLike, PreparedRun } from '../types/app';
import type { RunReport } from '../types/report';
import type { RunContext } from '../types/run';

interface ExecuteRunParams {
    inputPath: string;
    classificationContext: ClassificationContextLike;
    runContext: RunContext;
    runLogger: PreparedRun['runLogger'];
    progressReporter?: BuildProgressReporter | null;
}

async function executeRun({
    inputPath,
    classificationContext,
    runContext,
    runLogger,
    progressReporter = null
}: ExecuteRunParams): Promise<RunReport> {
    return runBuildPipeline({
        modsPath: inputPath,
        classificationContext,
        runContext,
        logger: runLogger,
        progressReporter
    }) as Promise<RunReport>;
}

module.exports = {
    executeRun
};
