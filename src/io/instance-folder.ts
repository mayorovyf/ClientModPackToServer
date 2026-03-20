const fs = require('node:fs');
const path = require('node:path');

const { PathValidationError } = require('../core/errors');

import type { InstanceLayout } from '../types/intake';

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
            inputKind: 'instance',
            instanceSource: 'direct'
        };
    }

    const nestedInstanceCandidates = [
        {
            instancePath: path.join(normalizedInputPath, 'minecraft'),
            instanceSource: 'minecraft-subdir'
        },
        {
            instancePath: path.join(normalizedInputPath, '.minecraft'),
            instanceSource: 'dot-minecraft-subdir'
        }
    ] as const;

    for (const candidate of nestedInstanceCandidates) {
        const nestedModsPath = path.join(candidate.instancePath, 'mods');

        if (fs.existsSync(nestedModsPath) && fs.statSync(nestedModsPath).isDirectory()) {
            return {
                instancePath: candidate.instancePath,
                modsPath: nestedModsPath,
                inputKind: 'instance',
                instanceSource: candidate.instanceSource
            };
        };
    }

    if (path.basename(normalizedInputPath).toLowerCase() === 'mods') {
        const instancePath = path.dirname(normalizedInputPath);
        validateDirectory(instancePath, 'Instance directory');

        return {
            instancePath,
            modsPath: normalizedInputPath,
            inputKind: 'mods-directory',
            instanceSource: 'mods-directory'
        };
    }

    throw new PathValidationError(
        `Instance directory must contain mods/, minecraft/mods/ or .minecraft/mods/: ${normalizedInputPath}`
    );
}

module.exports = {
    resolveInstanceLayout
};
