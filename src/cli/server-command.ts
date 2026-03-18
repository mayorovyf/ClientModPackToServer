const path = require('node:path');
const { spawn } = require('node:child_process');

const coreInstallerApi = require('../server/core-installer');
const runtimeApi = require('../server/runtime');
const preflightApi = require('../server/preflight');
const { UserInputError } = require('../core/errors');

import type { ApplicationLogger } from '../types/app';
import type { ParsedServerCliOptions } from './commands';

const { installServerCore } = coreInstallerApi;
const { buildManagedServerCommand, ensureServerEulaAccepted } = runtimeApi;
const { runServerPreflight } = preflightApi;

function logPreflightFindings(logger: ApplicationLogger, findings: ReturnType<typeof runServerPreflight>['findings']): void {
    for (const finding of findings) {
        if (finding.level === 'error') {
            logger.error(finding.message);
            continue;
        }

        if (finding.level === 'warning') {
            logger.warn(finding.message);
            continue;
        }

        logger.info(finding.message);
    }
}

async function runAttachedCommand({
    command,
    args,
    cwd
}: {
    command: string;
    args: string[];
    cwd: string;
}): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
            stdio: 'inherit',
            windowsHide: false
        });

        child.on('error', reject);
        child.on('close', (exitCode: number | null, signal: NodeJS.Signals | null) => {
            if (typeof exitCode === 'number' && exitCode !== 0) {
                reject(new UserInputError(`Server process exited with code ${exitCode}`));
                return;
            }

            if (signal) {
                reject(new UserInputError(`Server process exited with signal ${signal}`));
                return;
            }

            resolve();
        });
    });
}

export function runServerDoctorCommand(options: ParsedServerCliOptions, logger: ApplicationLogger): boolean {
    const result = runServerPreflight({
        mode: 'launch',
        targetDir: options.targetDir,
        coreType: options.coreType,
        minecraftVersion: options.minecraftVersion,
        javaPath: options.javaPath,
        explicitEntrypointPath: options.launcherPath,
        jvmArgs: options.jvmArgs,
        acceptEula: options.acceptEula
    });

    logPreflightFindings(logger, result.findings);

    if (result.ok) {
        logger.success('Server preflight passed.');
        return true;
    }

    logger.error('Server preflight failed.');
    return false;
}

export async function runServerInstallCommand(options: ParsedServerCliOptions, logger: ApplicationLogger): Promise<void> {
    const preflight = runServerPreflight({
        mode: 'install',
        targetDir: options.targetDir,
        coreType: options.coreType,
        minecraftVersion: options.minecraftVersion,
        javaPath: options.javaPath,
        acceptEula: options.acceptEula
    });

    logPreflightFindings(logger, preflight.findings);

    if (!preflight.ok || !preflight.targetDir || !options.minecraftVersion) {
        throw new UserInputError('Server installation preflight failed.');
    }

    const result = await installServerCore({
        targetDir: preflight.targetDir,
        coreType: options.coreType,
        minecraftVersion: options.minecraftVersion,
        loaderVersion: options.loaderVersion,
        javaPath: options.javaPath,
        acceptEula: options.acceptEula
    });

    logger.success(`Installed ${result.coreType} core into ${result.targetDir}`);
    logger.info(`Minecraft version: ${result.minecraftVersion}`);
    logger.info(`Loader version: ${result.loaderVersion || 'auto'}`);

    if (result.downloadedArtifactPath) {
        logger.info(`Downloaded artifact: ${result.downloadedArtifactPath}`);
    }

    if (result.entrypointPath) {
        logger.info(`Resolved launcher: ${result.entrypointPath}`);
    }

    for (const note of result.notes) {
        logger.info(note);
    }
}

export async function runServerStartCommand(options: ParsedServerCliOptions, logger: ApplicationLogger): Promise<void> {
    const preflight = runServerPreflight({
        mode: 'launch',
        targetDir: options.targetDir,
        coreType: options.coreType,
        minecraftVersion: options.minecraftVersion,
        javaPath: options.javaPath,
        explicitEntrypointPath: options.launcherPath,
        jvmArgs: options.jvmArgs,
        acceptEula: options.acceptEula
    });

    logPreflightFindings(logger, preflight.findings);

    if (!preflight.ok || !preflight.targetDir || !preflight.entrypoint) {
        throw new UserInputError('Server launch preflight failed.');
    }

    if (options.acceptEula) {
        const eulaPath = ensureServerEulaAccepted(preflight.targetDir);
        logger.info(`Updated EULA file: ${eulaPath}`);
    }

    const command = buildManagedServerCommand({
        entrypoint: preflight.entrypoint,
        javaPath: options.javaPath,
        jvmArgs: options.jvmArgs || ''
    });

    logger.success(`Starting server from ${preflight.targetDir}`);
    logger.info(`Working directory: ${preflight.targetDir}`);
    logger.info(`Launcher: ${preflight.entrypoint.path}`);
    logger.info(`Command: ${preflight.commandPreview || [command.command, ...command.args].join(' ')}`);

    await runAttachedCommand({
        command: command.command,
        args: command.args,
        cwd: preflight.targetDir
    });
}

export function resolveDefaultServerTargetDir(targetDir: string | null | undefined): string | null {
    if (!targetDir || !String(targetDir).trim()) {
        return null;
    }

    return path.resolve(String(targetDir).trim());
}
