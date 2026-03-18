const fs = require('node:fs');
const path = require('node:path');

const AdmZip = require('adm-zip');

const { ArchiveEntryReadError, ArchiveReadError, PathValidationError } = require('../core/errors');

interface ArchiveHandle {
    filePath: string;
    fileName: string;
    entries: string[];
    hasEntry(entryPath: string): boolean;
    readEntry(entryPath: string): Buffer | null;
    readText(entryPath: string): string | null;
}

function validateJarPath(filePath: string): void {
    if (!fs.existsSync(filePath)) {
        throw new PathValidationError(`File not found: ${filePath}`);
    }

    const stats = fs.statSync(filePath);

    if (!stats.isFile()) {
        throw new PathValidationError(`Path is not a file: ${filePath}`);
    }
}

function createArchiveHandle(filePath: string): ArchiveHandle {
    validateJarPath(filePath);

    try {
        const archive = new AdmZip(filePath);

        return {
            filePath,
            fileName: path.basename(filePath),
            entries: archive
                .getEntries()
                .filter((entry: { isDirectory: boolean }) => !entry.isDirectory)
                .map((entry: { entryName: string }) => entry.entryName),
            hasEntry(entryPath: string): boolean {
                return Boolean(archive.getEntry(entryPath));
            },
            readEntry(entryPath: string): Buffer | null {
                const entry = archive.getEntry(entryPath);

                if (!entry) {
                    return null;
                }

                try {
                    return entry.getData();
                } catch (error) {
                    throw new ArchiveEntryReadError(`Failed to read entry "${entryPath}" from ${path.basename(filePath)}`, {
                        cause: error
                    });
                }
            },
            readText(entryPath: string): string | null {
                const buffer = this.readEntry(entryPath);

                if (buffer === null) {
                    return null;
                }

                return buffer.toString('utf8');
            }
        };
    } catch (error) {
        throw new ArchiveReadError(`Failed to open jar archive: ${path.basename(filePath)}`, { cause: error });
    }
}

module.exports = {
    createArchiveHandle,
    validateJarPath
};
