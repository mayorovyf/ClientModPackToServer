const { createFileDecision } = require('../build/decision-model');
const { summarizeDescriptor } = require('../metadata/descriptor');
const { parseModFile } = require('../metadata/parse-mod-file');
const { createEngineList } = require('./engine-registry');
const { runClassificationEngines } = require('./engine-runner');
const { mergeClassificationResults } = require('./temporary-merge-policy');

import type { ClassificationContext } from '../types/classification';
import type { RunContext } from '../types/run';

function logParsingIssues(
    fileName: string,
    descriptor: ReturnType<typeof parseModFile>,
    record: (level: string, kind: string, message: string) => void
): void {
    for (const warning of descriptor.parsingWarnings) {
        record('warn', 'parse-warn', `${fileName}: ${warning.message}`);
    }

    for (const error of descriptor.parsingErrors) {
        record(error.fatal ? 'error' : 'warn', error.fatal ? 'parse-error' : 'parse-warn', `${fileName}: ${error.message}`);
    }
}

function classifyModFile({
    fileName,
    sourcePath,
    classificationContext,
    runContext,
    record = () => {}
}: {
    fileName: string;
    sourcePath: string;
    classificationContext: ClassificationContext;
    runContext: RunContext;
    record?: (level: string, kind: string, message: string) => void;
}) {
    record('info', 'discovery', `Discovered jar: ${fileName}`);
    record('info', 'jar', `Reading archive: ${fileName}`);

    const descriptor = parseModFile(sourcePath);
    record('info', 'parse', `Loader ${descriptor.loader}: ${fileName}`);
    logParsingIssues(fileName, descriptor, record);

    const classification = classifyDescriptor({
        descriptor,
        classificationContext,
        runContext,
        record
    });

    record('info', 'parse', `Descriptor: ${JSON.stringify(summarizeDescriptor(descriptor))}`);

    return createFileDecision({
        fileName,
        sourcePath,
        descriptor,
        classification
    });
}

function classifyDescriptor({
    descriptor,
    classificationContext,
    runContext,
    record = () => {}
}: {
    descriptor: ReturnType<typeof parseModFile>;
    classificationContext: ClassificationContext;
    runContext: RunContext;
    record?: (level: string, kind: string, message: string) => void;
}) {

    const engines = createEngineList(classificationContext.enabledEngines);
    const engineResults = runClassificationEngines({
        descriptor,
        runContext,
        classificationContext,
        engines,
        record
    });
    const classification = mergeClassificationResults(engineResults);

    if (classification.conflict.hasConflict) {
        record(
            'warn',
            'engine-conflict',
            `${descriptor.fileName}: conflict between keep=[${classification.conflict.keepEngines.join(', ')}] and remove=[${classification.conflict.removeEngines.join(', ')}]`
        );
    }

    record(
        'info',
        'classification',
        `${descriptor.fileName}: final ${classification.finalDecision} via ${classification.winningEngine || 'conservative-default'} (${classification.confidence})`
    );

    return classification;
}

module.exports = {
    classifyDescriptor,
    classifyModFile
};
