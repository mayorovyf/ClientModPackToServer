const { createFileDecision } = require('../build/decision-model');
const { summarizeDescriptor } = require('../metadata/descriptor');
const { parseModFile } = require('../metadata/parse-mod-file');
const { createEngineList } = require('./engine-registry');
const { runClassificationEngines } = require('./engine-runner');
const { mergeClassificationResults } = require('./temporary-merge-policy');

function logParsingIssues(fileName, descriptor, record) {
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
}) {
    record('info', 'discovery', `Discovered jar: ${fileName}`);
    record('info', 'jar', `Reading archive: ${fileName}`);

    const descriptor = parseModFile(sourcePath);
    record('info', 'parse', `Loader ${descriptor.loader}: ${fileName}`);
    logParsingIssues(fileName, descriptor, record);

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
            `${fileName}: conflict between keep=[${classification.conflict.keepEngines.join(', ')}] and remove=[${classification.conflict.removeEngines.join(', ')}]`
        );
    }

    record(
        'info',
        'classification',
        `${fileName}: final ${classification.finalDecision} via ${classification.winningEngine || 'conservative-default'} (${classification.confidence})`
    );
    record('info', 'parse', `Descriptor: ${JSON.stringify(summarizeDescriptor(descriptor))}`);

    return createFileDecision({
        fileName,
        sourcePath,
        descriptor,
        classification
    });
}

module.exports = {
    classifyModFile
};
