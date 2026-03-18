const fs = require('fs');
const path = require('path');

const { FileMoveError } = require('../core/errors');
const { isClientMod } = require('../core/legacy-matcher');
const { createHistoryRunDirectory, ensureDirectory } = require('./history');
const { listJarFiles } = require('./mods-folder');

function printSection(logger, title) {
    const line = '-'.repeat(40);
    logger.raw('');
    logger.raw(logger.paint(line, 'cyan'));
    logger.raw(logger.paint(`  ${title}`, 'cyan'));
    logger.raw(logger.paint(line, 'cyan'));
    logger.raw('');
}

function processModsFolder({ modsPath, blockList, historyDir, logger }) {
    printSection(logger, 'Legacy destructive workflow...');

    const historyDirCreated = ensureDirectory(historyDir);

    if (historyDirCreated) {
        logger.success('Папка history', '[СОЗДАНО]');
    }

    const jarFiles = listJarFiles(modsPath);
    logger.info(`Найдено .jar файлов: ${jarFiles.length}`);
    logger.raw('');

    let movedCount = 0;
    let historyRun = null;

    for (const file of jarFiles) {
        const matchedMod = isClientMod(file, blockList);

        if (!matchedMod) {
            continue;
        }

        if (!historyRun) {
            historyRun = createHistoryRunDirectory(historyDir);
            logger.success(`Папка истории: ${historyRun.runId}`, '[СОЗДАНО]');
            logger.raw('');
        }

        const sourcePath = path.join(modsPath, file);
        const destinationPath = path.join(historyRun.runDir, file);

        try {
            fs.renameSync(sourcePath, destinationPath);
            logger.success(`${file} (${matchedMod})`, '[УДАЛЁН]');
            movedCount += 1;
        } catch (error) {
            const moveError = new FileMoveError(`Не удалось переместить ${file}`, { cause: error });
            logger.error(`${moveError.message}: ${error.message}`);
        }
    }

    printSection(logger, 'Результат:');
    logger.success(`Удалено клиентских модов: ${movedCount}`);
    logger.info(`Серверных модов осталось: ${jarFiles.length - movedCount}`);

    if (historyRun) {
        logger.raw('');
        logger.info(`История сохранена: history/${historyRun.runId}`);
    } else {
        logger.raw('');
        logger.warn('Клиентских модов не найдено');
    }

    logger.raw('');

    return {
        movedCount,
        remainingCount: jarFiles.length - movedCount,
        historyRunId: historyRun ? historyRun.runId : null
    };
}

module.exports = {
    processModsFolder
};
