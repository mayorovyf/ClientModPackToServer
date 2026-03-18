const { createEngineErrorResult, createEngineResult } = require('./engine-result');
const { ENGINE_DECISIONS } = require('./constants');

import type { ClassificationContext, ClassificationEngine, EngineResult } from '../types/classification';
import type { ModDescriptor } from '../types/descriptor';
import type { RunContext } from '../types/run';

function resultLogLevel(result: EngineResult): 'info' | 'error' {
    if (result.decision === ENGINE_DECISIONS.error) {
        return 'error';
    }

    return 'info';
}

function formatEngineDecision(result: EngineResult): string {
    return `${result.engine} => ${result.decision} (${result.confidence})`;
}

function runClassificationEngines({
    descriptor,
    runContext,
    classificationContext,
    engines,
    record = () => {}
}: {
    descriptor: ModDescriptor;
    runContext?: RunContext | null;
    classificationContext: ClassificationContext;
    engines: ClassificationEngine[];
    record?: (level: string, kind: string, message: string) => void;
}): EngineResult[] {
    const results: EngineResult[] = [];

    for (const engine of engines) {
        record('info', 'engine-execution', `${descriptor.fileName}: start ${engine.name}`);

        let result: EngineResult;

        try {
            result = createEngineResult({
                engine: engine.name,
                ...(engine.classify({
                    descriptor,
                    runContext,
                    classificationContext
                }) || {})
            });
        } catch (error: unknown) {
            result = createEngineErrorResult({
                engine: engine.name,
                error,
                reason: `Engine ${engine.name} failed`
            });
        }

        results.push(result);

        record(
            resultLogLevel(result),
            result.decision === ENGINE_DECISIONS.error ? 'engine-error' : 'engine-decision',
            `${descriptor.fileName}: ${formatEngineDecision(result)} | ${result.reason}`
        );

        for (const warning of result.warnings) {
            record('warn', 'engine-warning', `${descriptor.fileName}: ${result.engine} warning: ${warning}`);
        }
    }

    return results;
}

module.exports = {
    runClassificationEngines
};
