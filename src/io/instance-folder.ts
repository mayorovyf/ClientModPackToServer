const fs = require('node:fs');
const path = require('node:path');

const { PathValidationError } = require('../core/errors');

interface InstanceLayout {
    instancePath: string;
    modsPath: string;
    inputKind: 'instance' | 'mods-directory';
}

function validateDirectory(directoryPath: string, label: string): void {
    if (!fs.existsSync(directoryPath)) {
        throw new PathValidationError(`${label} not found: ${directoryPath}`);
    }

    const stats = fs.statSync(directoryPath);

    if (!stats.isDirectory()) {
        throw new PathValidationError(`${label} is not a directory: ${directoryPath}`);
    }
}

function resolveInstanceLayout(inputPath: string): InstanceLayout {
    const normalizedInputPath = path.resolve(String(inputPath || '').trim());

    validateDirectory(normalizedInputPath, 'Input path');

    const directModsPath = path.join(normalizedInputPath, 'mods');

    if (fs.existsSync(directModsPath) && fs.statSync(directModsPath).isDirectory()) {
        return {
            instancePath: normalizedInputPath,
            modsPath: directModsPath,
            inputKind: 'instance'
        };
    }

    if (path.basename(normalizedInputPath).toLowerCase() === 'mods') {
        const instancePath = path.dirname(normalizedInputPath);
        validateDirectory(instancePath, 'Instance directory');

        return {
            instancePath,
            modsPath: normalizedInputPath,
            inputKind: 'mods-directory'
        };
    }

    throw new PathValidationError(`Instance directory must contain a mods folder: ${normalizedInputPath}`);
}

module.exports = {
    resolveInstanceLayout
};
