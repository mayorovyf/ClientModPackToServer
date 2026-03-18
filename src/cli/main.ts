const path = require('node:path');
const readline = require('node:readline');

const { runApplication } = require('../app/run-application');
const { printHelp, parseCliArgs } = require('./args');
const { printBanner } = require('./banner');
const { createRuntimeConfig } = require('../config/runtime-config');
const { AppError, UserInputError } = require('../core/errors');
const { createLogger } = require('../core/logger');
const { cleanInputPath } = require('../utils/path-utils');

import type { ApplicationLogger } from '../types/app';
import type { RuntimeConfig } from '../types/config';

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
    printBanner(logger);

    const inputPath = await resolveInputPath(config, logger);

    return runApplication({
        config,
        inputPath,
        logger
    });
}

async function main(): Promise<void> {
    const scriptDir = path.resolve(__dirname, '..', '..');
    const cliOptions = parseCliArgs(process.argv.slice(2));
    const config = createRuntimeConfig({ scriptDir, cliOptions });
    const logger = createLogger({
        useColors: config.useColors,
        level: config.logLevel
    }) as ApplicationLogger;

    if (cliOptions.help) {
        printBanner(logger);
        printHelp(logger);
        return;
    }

    try {
        await runCli(config, logger);
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
