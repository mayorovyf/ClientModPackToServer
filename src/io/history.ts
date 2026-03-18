const fs = require('node:fs');
const path = require('node:path');

const { DirectoryCreationError } = require('../core/errors');

function formatHistoryRunId(date: Date = new Date()): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `client-${day}.${month}.${year}-${hours}.${minutes}.${seconds}`;
}

function ensureDirectory(directoryPath: string): boolean {
    if (fs.existsSync(directoryPath)) {
        return false;
    }

    try {
        fs.mkdirSync(directoryPath, { recursive: true });
        return true;
    } catch (error) {
        throw new DirectoryCreationError(`Failed to create directory: ${directoryPath}`, { cause: error });
    }
}

function createHistoryRunDirectory(historyDir: string): { runId: string; runDir: string } {
    const baseRunId = formatHistoryRunId();
    let suffix = 0;

    while (suffix < 1000) {
        const runId = suffix === 0 ? baseRunId : `${baseRunId}-${suffix + 1}`;
        const runDir = path.join(historyDir, runId);

        try {
            fs.mkdirSync(runDir);
            return { runId, runDir };
        } catch (error: unknown) {
            const errorCode = error && typeof error === 'object' && 'code' in error ? String((error as { code?: string }).code) : null;

            if (errorCode === 'EEXIST') {
                suffix += 1;
                continue;
            }

            throw new DirectoryCreationError(`Failed to create history directory: ${runDir}`, { cause: error });
        }
    }

    throw new DirectoryCreationError('Failed to allocate a unique history directory name');
}

module.exports = {
    createHistoryRunDirectory,
    ensureDirectory,
    formatHistoryRunId
};
