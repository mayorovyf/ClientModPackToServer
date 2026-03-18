const fs = require('fs');
const path = require('path');

const AdmZip = require('adm-zip');

const { ArchiveEntryReadError, ArchiveReadError, PathValidationError } = require('../core/errors');

function validateJarPath(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new PathValidationError(`Файл не найден: ${filePath}`);
    }

    const stats = fs.statSync(filePath);

    if (!stats.isFile()) {
        throw new PathValidationError(`Указанный путь не является файлом: ${filePath}`);
    }
}

function createArchiveHandle(filePath) {
    validateJarPath(filePath);

    try {
        const archive = new AdmZip(filePath);

        return {
            filePath,
            fileName: path.basename(filePath),
            entries: archive
                .getEntries()
                .filter((entry) => !entry.isDirectory)
                .map((entry) => entry.entryName),
            hasEntry(entryPath) {
                return Boolean(archive.getEntry(entryPath));
            },
            readEntry(entryPath) {
                const entry = archive.getEntry(entryPath);

                if (!entry) {
                    return null;
                }

                try {
                    return entry.getData();
                } catch (error) {
                    throw new ArchiveEntryReadError(`Не удалось прочитать entry "${entryPath}" из ${path.basename(filePath)}`, {
                        cause: error
                    });
                }
            },
            readText(entryPath) {
                const buffer = this.readEntry(entryPath);

                if (buffer === null) {
                    return null;
                }

                return buffer.toString('utf8');
            }
        };
    } catch (error) {
        throw new ArchiveReadError(`Не удалось открыть jar-архив: ${path.basename(filePath)}`, { cause: error });
    }
}

module.exports = {
    createArchiveHandle,
    validateJarPath
};
