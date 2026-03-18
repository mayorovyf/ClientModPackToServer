const fs = require('node:fs');

const { PathValidationError } = require('../core/errors');

function validateModsPath(modsPath: string): void {
    if (!fs.existsSync(modsPath)) {
        throw new PathValidationError(`Directory not found: ${modsPath}`);
    }

    const stats = fs.statSync(modsPath);

    if (!stats.isDirectory()) {
        throw new PathValidationError(`Path is not a directory: ${modsPath}`);
    }
}

function listJarFiles(modsPath: string): string[] {
    validateModsPath(modsPath);
    return fs.readdirSync(modsPath).filter((file: string) => file.toLowerCase().endsWith('.jar'));
}

module.exports = {
    listJarFiles,
    validateModsPath
};
