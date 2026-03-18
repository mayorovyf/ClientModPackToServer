const { executeRun } = require('./execute-run');
const { finalizeRun } = require('./finalize-run');
const { prepareRun } = require('./prepare-run');

import type { BuildProgressReporter, FinalizedApplicationRun, ApplicationLogger } from '../types/app';
import type { RuntimeConfig } from '../types/config';

interface RunApplicationParams {
    config: RuntimeConfig;
    inputPath: string;
    logger: ApplicationLogger;
    progressReporter?: BuildProgressReporter | null;
}

async function runApplication({
    config,
    inputPath,
    logger,
    progressReporter = null
}: RunApplicationParams): Promise<FinalizedApplicationRun> {
    const preparedRun = await prepareRun({
        config,
        inputPath,
        logger
    });
    const report = await executeRun({
        ...preparedRun,
        progressReporter
    });

    return finalizeRun({
        report,
        runContext: preparedRun.runContext,
        runLogger: preparedRun.runLogger,
        registryRuntime: preparedRun.registryRuntime
    });
}

module.exports = {
    runApplication
};
