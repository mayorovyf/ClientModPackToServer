const fs = require('fs');
const path = require('path');

const { DirectoryCreationError } = require('../core/errors');

function formatHistoryRunId(date = new Date()) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `client-${day}.${month}.${year}-${hours}.${minutes}.${seconds}`;
}

function ensureDirectory(directoryPath) {
    if (fs.existsSync(directoryPath)) {
        return false;
    }

    try {
        fs.mkdirSync(directoryPath, { recursive: true });
        return true;
    } catch (error) {
        throw new DirectoryCreationError(`Не удалось создать директорию: ${directoryPath}`, { cause: error });
    }
}

function createHistoryRunDirectory(historyDir) {
    const baseRunId = formatHistoryRunId();
    let suffix = 0;

    while (suffix < 1000) {
        const runId = suffix === 0 ? baseRunId : `${baseRunId}-${suffix + 1}`;
        const runDir = path.join(historyDir, runId);

        try {
            fs.mkdirSync(runDir);
            return { runId, runDir };
        } catch (error) {
            if (error.code === 'EEXIST') {
                suffix += 1;
                continue;
            }

            throw new DirectoryCreationError(`Не удалось создать папку истории: ${runDir}`, { cause: error });
        }
    }

    throw new DirectoryCreationError('Не удалось подобрать уникальное имя для папки истории');
}

module.exports = {
    createHistoryRunDirectory,
    ensureDirectory,
    formatHistoryRunId
};
