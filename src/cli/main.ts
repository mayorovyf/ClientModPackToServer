const path = require('node:path');
const readline = require('node:readline');

const { runApplication } = require('../app/run-application');
const { printHelp } = require('./args');
const { parseTopLevelCliCommand } = require('./commands');
const { printBanner } = require('./banner');
const { createRuntimeConfig } = require('../config/runtime-config');
const { AppError, UserInputError } = require('../core/errors');
const { createLogger } = require('../core/logger');
const { cleanInputPath } = require('../utils/path-utils');
const { loadRunPresets, saveRunPreset, deleteRunPreset, getRunPresetStoragePath } = require('../tui/state/presets');
const { applyCliOptionsToRunForm, findRunPreset, mergeCliOptions, runFormToCliOptions, summarizeRunPreset } = require('./preset-utils');
const {
    runServerDoctorCommand,
    runServerInstallCommand,
    runServerStartCommand
} = require('./server-command');

import type { ApplicationLogger } from '../types/app';
import type { RuntimeConfig } from '../types/config';
import type { ParsedTopLevelCliCommand } from './commands.js';
import type { RunPreset } from '../tui/state/presets.js';

function promptForModsPath(logger: ApplicationLogger): Promise<string> {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        logger.raw('');
        logger.hint('Перетащите папку с модами в это окно');
        logger.hint('или введите путь вручную');
        logger.raw('');

        const prompt = logger.paint('Укажите путь до папки с модами: ', 'cyan');

        rl.question(prompt, (answer: string) => {
            rl.close();
            resolve(cleanInputPath(answer));
        });
    });
}

function handleCliError(error: unknown, logger: ApplicationLogger): void {
    if (error instanceof Error && error instanceof AppError) {
        logger.error(error.message);
    } else if (error instanceof Error) {
        logger.error(`Непредвиденная ошибка: ${error.message}`);
    } else {
        logger.error(`Непредвиденная ошибка: ${String(error)}`);
    }

    if (error && typeof error === 'object' && 'cause' in error && error.cause && logger.canLog('debug')) {
        const cause = error.cause;

        if (cause instanceof Error) {
            logger.debug(cause.stack || cause.message);
        } else {
            logger.debug(String(cause));
        }
    }
}

async function resolveInputPath(config: RuntimeConfig, logger: ApplicationLogger): Promise<string> {
    if (config.inputPath) {
        return config.inputPath;
    }

    const promptedPath = await promptForModsPath(logger);

    if (!promptedPath) {
        throw new UserInputError('Путь не указан');
    }

    return path.resolve(promptedPath);
}

async function runCli(config: RuntimeConfig, logger: ApplicationLogger) {
    const inputPath = await resolveInputPath(config, logger);

    return runApplication({
        config,
        inputPath,
        logger
    });
}

function getBaseLogger(): ApplicationLogger {
    return createLogger({
        useColors: process.env.NO_COLOR ? false : true,
        level: process.env.CLIENT_TO_SERVER_LOG_LEVEL || 'info'
    }) as ApplicationLogger;
}

function printPreset(preset: RunPreset, logger: ApplicationLogger): void {
    logger.success(`Preset: ${preset.name}`);
    logger.info(`ID: ${preset.id}`);
    logger.info(`Updated: ${preset.updatedAt}`);
    logger.info(`Summary: ${summarizeRunPreset(preset)}`);
    logger.info(`Input: ${preset.form.inputPath || '<not set>'}`);
    logger.info(`Output: ${preset.form.outputPath || '<default>'}`);
    logger.info(`Reports: ${preset.form.reportDir || '<default>'}`);
    logger.info(`Validation entrypoint: ${preset.form.validationEntrypointPath || '<auto>'}`);
}

function handlePresetCommand(command: ParsedTopLevelCliCommand, logger: ApplicationLogger): RuntimeConfig | null {
    const presets = loadRunPresets();

    switch (command.kind) {
        case 'preset-list':
            logger.info(`Preset storage: ${getRunPresetStoragePath()}`);

            if (presets.length === 0) {
                logger.warn('No presets have been saved yet.');
                return null;
            }

            for (const preset of presets) {
                logger.raw(`${preset.name} | ${preset.id} | ${summarizeRunPreset(preset)} | ${preset.updatedAt}`);
            }

            return null;
        case 'preset-show': {
            const preset = findRunPreset(presets, command.selector);

            if (!preset) {
                throw new UserInputError(`Preset not found: ${command.selector}`);
            }

            printPreset(preset, logger);
            return null;
        }
        case 'preset-delete': {
            const preset = findRunPreset(presets, command.selector);

            if (!preset) {
                throw new UserInputError(`Preset not found: ${command.selector}`);
            }

            deleteRunPreset(preset.id);
            logger.success(`Preset deleted: ${preset.name}`);
            return null;
        }
        case 'preset-save': {
            const form = applyCliOptionsToRunForm(command.options);
            const preset = saveRunPreset({
                name: command.name,
                form
            });

            logger.success(`Preset saved: ${preset.name}`);
            printPreset(preset, logger);
            return null;
        }
        case 'preset-run': {
            const preset = findRunPreset(presets, command.selector);

            if (!preset) {
                throw new UserInputError(`Preset not found: ${command.selector}`);
            }

            const mergedOptions = mergeCliOptions(runFormToCliOptions(preset.form), command.options);
            logger.success(`Running preset: ${preset.name}`);

            return createRuntimeConfig({
                scriptDir: path.resolve(__dirname, '..', '..'),
                cliOptions: mergedOptions
            });
        }
        default:
            return null;
    }
}

async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
    const scriptDir = path.resolve(__dirname, '..', '..');
    const logger = getBaseLogger();
    const command = parseTopLevelCliCommand(argv);

    if (command.kind === 'help') {
        printBanner(logger);
        printHelp(logger);
        return;
    }

    printBanner(logger);

    try {
        switch (command.kind) {
            case 'run': {
                const config = createRuntimeConfig({ scriptDir, cliOptions: command.options });
                await runCli(config, logger);
                break;
            }
            case 'preset-list':
            case 'preset-show':
            case 'preset-delete':
            case 'preset-save': {
                handlePresetCommand(command, logger);
                break;
            }
            case 'preset-run': {
                const config = handlePresetCommand(command, logger);

                if (config) {
                    await runCli(config, logger);
                }
                break;
            }
            case 'server-doctor': {
                const ok = runServerDoctorCommand(command.options, logger);
                process.exitCode = ok ? 0 : 1;
                break;
            }
            case 'server-install':
                await runServerInstallCommand(command.options, logger);
                break;
            case 'server-start':
                await runServerStartCommand(command.options, logger);
                break;
            default:
                throw new UserInputError(`Unsupported command: ${(command as { kind: string }).kind}`);
        }
    } catch (error) {
        handleCliError(error, logger);
        process.exitCode = 1;
    }
}

module.exports = {
    handleCliError,
    main,
    promptForModsPath,
    resolveInputPath,
    runCli
};

if (require.main === module) {
    void main();
}
