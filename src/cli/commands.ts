const { RunConfigurationError } = require('../core/errors');
const { parseCliArgs } = require('./args');

import type { CliOptions } from '../types/config';
import type { ServerCoreType } from '../server/types.js';

type ServerValueFlag =
    | '--target-dir'
    | '--core'
    | '--minecraft'
    | '--loader'
    | '--java'
    | '--launcher'
    | '--jvm-args';

type ServerBooleanFlag = '--accept-eula' | '--help';

export interface ParsedServerCliOptions {
    targetDir: string | null;
    coreType: ServerCoreType;
    minecraftVersion: string | null;
    loaderVersion: string | null;
    javaPath: string | null;
    launcherPath: string | null;
    jvmArgs: string | null;
    acceptEula: boolean;
    help: boolean;
}

export type ParsedTopLevelCliCommand =
    | { kind: 'help' }
    | { kind: 'run'; options: CliOptions }
    | { kind: 'preset-list' }
    | { kind: 'preset-save'; name: string; options: CliOptions }
    | { kind: 'preset-show'; selector: string }
    | { kind: 'preset-delete'; selector: string }
    | { kind: 'preset-run'; selector: string; options: CliOptions }
    | { kind: 'server-doctor'; options: ParsedServerCliOptions }
    | { kind: 'server-install'; options: ParsedServerCliOptions }
    | { kind: 'server-start'; options: ParsedServerCliOptions };

const SERVER_VALUE_FLAGS = new Set<ServerValueFlag>([
    '--target-dir',
    '--core',
    '--minecraft',
    '--loader',
    '--java',
    '--launcher',
    '--jvm-args'
]);
const SERVER_BOOLEAN_FLAGS = new Set<ServerBooleanFlag>(['--accept-eula', '--help']);

function splitFlag(token: string): { key: string; value: string | null } {
    const eqIndex = token.indexOf('=');

    if (eqIndex === -1) {
        return { key: token, value: null };
    }

    return {
        key: token.slice(0, eqIndex),
        value: token.slice(eqIndex + 1)
    };
}

function requireNonEmptyValue(value: string | null | undefined, label: string): string {
    const normalized = String(value || '').trim();

    if (!normalized) {
        throw new RunConfigurationError(`${label} is required`);
    }

    return normalized;
}

export function parseServerCliArgs(argv: string[] = []): ParsedServerCliOptions {
    const options: ParsedServerCliOptions = {
        targetDir: null,
        coreType: 'fabric',
        minecraftVersion: null,
        loaderVersion: null,
        javaPath: null,
        launcherPath: null,
        jvmArgs: null,
        acceptEula: false,
        help: false
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];

        if (!token) {
            continue;
        }

        const { key, value } = splitFlag(token);

        if (SERVER_BOOLEAN_FLAGS.has(key as ServerBooleanFlag)) {
            if (key === '--accept-eula') {
                options.acceptEula = true;
            }

            if (key === '--help') {
                options.help = true;
            }

            continue;
        }

        if (!SERVER_VALUE_FLAGS.has(key as ServerValueFlag)) {
            throw new RunConfigurationError(`Unknown server argument: ${token}`);
        }

        const resolvedValue = value !== null ? value : argv[index + 1];

        if (!resolvedValue || resolvedValue.startsWith('--')) {
            throw new RunConfigurationError(`Argument ${key} requires a value`);
        }

        if (value === null) {
            index += 1;
        }

        switch (key) {
            case '--target-dir':
                options.targetDir = resolvedValue;
                break;
            case '--core':
                if (resolvedValue !== 'fabric' && resolvedValue !== 'forge' && resolvedValue !== 'neoforge') {
                    throw new RunConfigurationError(`Unknown server core type: ${resolvedValue}`);
                }
                options.coreType = resolvedValue;
                break;
            case '--minecraft':
                options.minecraftVersion = resolvedValue;
                break;
            case '--loader':
                options.loaderVersion = resolvedValue;
                break;
            case '--java':
                options.javaPath = resolvedValue;
                break;
            case '--launcher':
                options.launcherPath = resolvedValue;
                break;
            case '--jvm-args':
                options.jvmArgs = resolvedValue;
                break;
            default:
                throw new RunConfigurationError(`Unsupported server argument: ${key}`);
        }
    }

    return options;
}

function parsePresetCommand(argv: string[]): ParsedTopLevelCliCommand {
    const action = argv[1];

    if (!action || action === '--help') {
        return { kind: 'help' };
    }

    if (action === 'list') {
        return { kind: 'preset-list' };
    }

    if (action === 'save') {
        const name = requireNonEmptyValue(argv[2], 'Preset name');
        return {
            kind: 'preset-save',
            name,
            options: parseCliArgs(argv.slice(3))
        };
    }

    if (action === 'show') {
        return {
            kind: 'preset-show',
            selector: requireNonEmptyValue(argv[2], 'Preset selector')
        };
    }

    if (action === 'delete') {
        return {
            kind: 'preset-delete',
            selector: requireNonEmptyValue(argv[2], 'Preset selector')
        };
    }

    if (action === 'run') {
        return {
            kind: 'preset-run',
            selector: requireNonEmptyValue(argv[2], 'Preset selector'),
            options: parseCliArgs(argv.slice(3))
        };
    }

    throw new RunConfigurationError(`Unknown preset command: ${action}`);
}

function parseServerCommand(argv: string[]): ParsedTopLevelCliCommand {
    const action = argv[1];

    if (!action || action === '--help') {
        return { kind: 'help' };
    }

    const options = parseServerCliArgs(argv.slice(2));

    if (options.help) {
        return { kind: 'help' };
    }

    switch (action) {
        case 'doctor':
            return { kind: 'server-doctor', options };
        case 'install':
            return { kind: 'server-install', options };
        case 'start':
            return { kind: 'server-start', options };
        default:
            throw new RunConfigurationError(`Unknown server command: ${action}`);
    }
}

export function parseTopLevelCliCommand(argv: string[] = []): ParsedTopLevelCliCommand {
    if (argv.length === 0) {
        return {
            kind: 'run',
            options: parseCliArgs(argv)
        };
    }

    const firstToken = argv[0];

    if (firstToken === '--help' || firstToken === 'help') {
        return { kind: 'help' };
    }

    if (firstToken === 'preset') {
        return parsePresetCommand(argv);
    }

    if (firstToken === 'server') {
        return parseServerCommand(argv);
    }

    return {
        kind: 'run',
        options: parseCliArgs(argv)
    };
}
