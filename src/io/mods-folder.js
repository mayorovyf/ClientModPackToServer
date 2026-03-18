const fs = require('fs');

const { PathValidationError } = require('../core/errors');

function validateModsPath(modsPath) {
    if (!fs.existsSync(modsPath)) {
        throw new PathValidationError(`Папка не найдена: ${modsPath}`);
    }

    const stats = fs.statSync(modsPath);

    if (!stats.isDirectory()) {
        throw new PathValidationError(`Указанный путь не является папкой: ${modsPath}`);
    }
}

function listJarFiles(modsPath) {
    validateModsPath(modsPath);
    return fs.readdirSync(modsPath).filter((file) => file.toLowerCase().endsWith('.jar'));
}

module.exports = {
    listJarFiles,
    validateModsPath
};
