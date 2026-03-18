const fs = require('node:fs');
const path = require('node:path');

const { FileMoveError } = require('../core/errors');
const { isClientMod } = require('../core/legacy-matcher');
const { createHistoryRunDirectory, ensureDirectory } = require('./history');
const { listJarFiles } = require('./mods-folder');

interface LegacyWorkflowLogger {
    raw(message?: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    success(message: string, label?: string): void;
    paint(text: string, color?: string): string;
}

function printSection(logger: LegacyWorkflowLogger, title: string): void {
    const line = '-'.repeat(40);
    logger.raw('');
    logger.raw(logger.paint(line, 'cyan'));
    logger.raw(logger.paint(`  ${title}`, 'cyan'));
    logger.raw(logger.paint(line, 'cyan'));
    logger.raw('');
}

function processModsFolder({
    modsPath,
    blockList,
    historyDir,
    logger
}: {
    modsPath: string;
    blockList: string[];
    historyDir: string;
    logger: LegacyWorkflowLogger;
}): {
    movedCount: number;
    remainingCount: number;
    historyRunId: string | null;
} {
    printSection(logger, 'Legacy destructive workflow...');

    const historyDirCreated = ensureDirectory(historyDir);

    if (historyDirCreated) {
        logger.success('Папка history', '[СОЗДАНО]');
    }

    const jarFiles = listJarFiles(modsPath);
    logger.info(`Найдено .jar файлов: ${jarFiles.length}`);
    logger.raw('');

    let movedCount = 0;
    let historyRun: { runId: string; runDir: string } | null = null;

    for (const file of jarFiles) {
        const matchedMod = isClientMod(file, blockList);

        if (!matchedMod) {
            continue;
        }

        if (!historyRun) {
            const createdHistoryRun = createHistoryRunDirectory(historyDir);
            historyRun = createdHistoryRun;
            logger.success(`Папка истории: ${createdHistoryRun.runId}`, '[СОЗДАНО]');
            logger.raw('');
        }

        if (!historyRun) {
            throw new Error('History run should exist before moving files');
        }

        const activeHistoryRun = historyRun;

        const sourcePath = path.join(modsPath, file);
        const destinationPath = path.join(activeHistoryRun.runDir, file);

        try {
            fs.renameSync(sourcePath, destinationPath);
            logger.success(`${file} (${matchedMod})`, '[УДАЛЁН]');
            movedCount += 1;
        } catch (error) {
            const moveError = new FileMoveError(`Не удалось переместить ${file}`, { cause: error });
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`${moveError.message}: ${message}`);
        }
    }

    printSection(logger, 'Результат:');
    logger.success(`Удалено клиентских модов: ${movedCount}`);
    logger.info(`Серверных модов осталось: ${jarFiles.length - movedCount}`);

    if (historyRun) {
        const savedHistoryRun = historyRun;
        logger.raw('');
        logger.info(`История сохранена: history/${savedHistoryRun.runId}`);
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
