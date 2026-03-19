import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import type { RunFormState } from './app-state.js';

const require = createRequire(import.meta.url);
const { normalizeRunIdPrefix } = require('../../config/runtime-config.js');
const { resolveInstanceLayout } = require('../../io/instance-folder.js');

export type RunPreflightSeverity = 'ok' | 'warning' | 'error';
export type RunPreflightCheckId =
    | 'inputPath'
    | 'outputPath'
    | 'reportDir'
    | 'serverDirName'
    | 'runIdPrefix'
    | 'validation'
    | 'registry';

export interface RunPreflightCheck {
    id: RunPreflightCheckId;
    severity: RunPreflightSeverity;
    title: string;
    summary: string;
    details: string;
}

export interface RunPreflightSummary {
    total: number;
    errors: number;
    warnings: number;
    ok: number;
    canRun: boolean;
}

function canWriteToDirectory(targetPath: string): boolean {
    try {
        fs.accessSync(targetPath, fs.constants.W_OK);
        return true;
    } catch {
        return false;
    }
}

function getExistingParentDirectory(targetPath: string): string | null {
    let currentPath = path.resolve(targetPath);

    while (currentPath && currentPath !== path.dirname(currentPath)) {
        if (fs.existsSync(currentPath)) {
            return currentPath;
        }

        currentPath = path.dirname(currentPath);
    }

    return fs.existsSync(currentPath) ? currentPath : null;
}

function buildDirectoryCheck(
    id: 'outputPath' | 'reportDir',
    title: string,
    configuredPath: string,
    fallbackPath: string
): RunPreflightCheck {
    const resolvedPath = configuredPath.trim()
        ? path.resolve(configuredPath.trim())
        : path.resolve(fallbackPath);
    const parentDirectory = getExistingParentDirectory(resolvedPath);

    if (!parentDirectory) {
        return {
            id,
            severity: 'error',
            title,
            summary: 'No writable parent directory',
            details: `The path ${resolvedPath} does not have an existing parent directory.`
        };
    }

    if (!canWriteToDirectory(parentDirectory)) {
        return {
            id,
            severity: 'error',
            title,
            summary: 'Parent directory is not writable',
            details: `The path ${parentDirectory} is not writable for this process.`
        };
    }

    return {
        id,
        severity: 'ok',
        title,
        summary: configuredPath.trim() ? 'Custom directory is writable' : 'Default directory is available',
        details: `Resolved path: ${resolvedPath}`
    };
}

function buildInputPathCheck(form: RunFormState): RunPreflightCheck {
    const inputPath = form.inputPath.trim();

    if (!inputPath) {
        return {
            id: 'inputPath',
            severity: 'error',
            title: 'Instance path',
            summary: 'Input instance path is required',
            details: 'Set the root directory of the client instance before starting the pipeline.'
        };
    }

    const resolvedPath = path.resolve(inputPath);

    if (!fs.existsSync(resolvedPath)) {
        return {
            id: 'inputPath',
            severity: 'error',
            title: 'Instance path',
            summary: 'Instance directory was not found',
            details: `The path ${resolvedPath} does not exist.`
        };
    }

    if (!fs.statSync(resolvedPath).isDirectory()) {
        return {
            id: 'inputPath',
            severity: 'error',
            title: 'Instance path',
            summary: 'Input path is not a directory',
            details: `The path ${resolvedPath} exists but is not a directory.`
        };
    }

    try {
        const instanceLayout = resolveInstanceLayout(resolvedPath);
        const resolvedInstancePath = instanceLayout.instancePath;
        const isNestedInstance = resolvedInstancePath !== resolvedPath;
        const isModsDirectory = instanceLayout.inputKind === 'mods-directory';

        return {
            id: 'inputPath',
            severity: 'ok',
            title: 'Instance path',
            summary: isNestedInstance
                ? 'Launcher instance root resolved successfully'
                : isModsDirectory
                    ? 'mods directory is available'
                    : 'Instance directory is available',
            details: [
                `Input: ${resolvedPath}`,
                `Instance: ${resolvedInstancePath}`,
                `Mods: ${instanceLayout.modsPath}`
            ].join(' | ')
        };
    } catch (error) {
        return {
            id: 'inputPath',
            severity: 'error',
            title: 'Instance path',
            summary: 'No supported instance layout was found',
            details: error instanceof Error ? error.message : String(error)
        };
    }
}

function buildServerDirNameCheck(form: RunFormState): RunPreflightCheck {
    const serverDirName = form.serverDirName.trim();

    if (!serverDirName) {
        return {
            id: 'serverDirName',
            severity: 'ok',
            title: 'Server dir name',
            summary: 'Auto naming is enabled',
            details: 'The server directory name will be derived automatically from the instance.'
        };
    }

    if (serverDirName.includes('/') || serverDirName.includes('\\')) {
        return {
            id: 'serverDirName',
            severity: 'error',
            title: 'Server dir name',
            summary: 'Directory name must not contain path separators',
            details: 'Use only a folder name here, not a full path.'
        };
    }

    return {
        id: 'serverDirName',
        severity: 'ok',
        title: 'Server dir name',
        summary: 'Custom server directory name is valid',
        details: serverDirName
    };
}

function buildRunIdPrefixCheck(form: RunFormState): RunPreflightCheck {
    try {
        const normalizedPrefix = normalizeRunIdPrefix(form.runIdPrefix || null);

        return {
            id: 'runIdPrefix',
            severity: 'ok',
            title: 'Run ID prefix',
            summary: form.runIdPrefix.trim() ? 'Custom prefix is valid' : 'Default prefix will be used',
            details: normalizedPrefix
        };
    } catch (error) {
        return {
            id: 'runIdPrefix',
            severity: 'error',
            title: 'Run ID prefix',
            summary: 'Run ID prefix is invalid',
            details: error instanceof Error ? error.message : String(error)
        };
    }
}

function buildValidationCheck(form: RunFormState): RunPreflightCheck {
    if (form.validationMode === 'off') {
        return {
            id: 'validation',
            severity: 'ok',
            title: 'Validation',
            summary: 'Validation is disabled',
            details: 'The pipeline will skip post-build smoke-test validation.'
        };
    }

    const explicitEntrypointPath = form.validationEntrypointPath.trim();

    if (!explicitEntrypointPath) {
        return {
            id: 'validation',
            severity: form.validationMode === 'force' || form.validationMode === 'require' ? 'warning' : 'ok',
            title: 'Validation',
            summary: 'Launcher will be auto-detected after the build',
            details: 'No explicit validation entrypoint is set. The pipeline will rely on launcher auto-detection.'
        };
    }

    const resolvedPath = path.resolve(explicitEntrypointPath);

    if (!fs.existsSync(resolvedPath)) {
        return {
            id: 'validation',
            severity: 'error',
            title: 'Validation',
            summary: 'Explicit validation entrypoint was not found',
            details: `The path ${resolvedPath} does not exist.`
        };
    }

    const timeoutValue = form.validationTimeoutMs.trim();

    if (timeoutValue && (!Number.isInteger(Number(timeoutValue)) || Number(timeoutValue) <= 0)) {
        return {
            id: 'validation',
            severity: 'error',
            title: 'Validation',
            summary: 'Validation timeout must be a positive integer',
            details: `Current value: ${timeoutValue}`
        };
    }

    return {
        id: 'validation',
        severity: 'ok',
        title: 'Validation',
        summary: 'Validation launcher and timeout look valid',
        details: `Launcher: ${resolvedPath}`
    };
}

function buildRegistryCheck(form: RunFormState): RunPreflightCheck {
    if (form.registryMode === 'offline' || form.registryMode === 'pinned') {
        return {
            id: 'registry',
            severity: 'ok',
            title: 'Registry',
            summary: `Registry mode: ${form.registryMode}`,
            details: 'This run will not require a fresh remote registry manifest.'
        };
    }

    const manifestUrl = form.registryManifestUrl.trim();

    if (!manifestUrl) {
        return {
            id: 'registry',
            severity: 'error',
            title: 'Registry',
            summary: 'Registry manifest URL is missing',
            details: 'Auto or refresh mode requires a valid manifest URL.'
        };
    }

    try {
        const normalizedUrl = new URL(manifestUrl).toString();

        return {
            id: 'registry',
            severity: 'ok',
            title: 'Registry',
            summary: `Registry mode: ${form.registryMode}`,
            details: normalizedUrl
        };
    } catch {
        return {
            id: 'registry',
            severity: 'error',
            title: 'Registry',
            summary: 'Registry manifest URL is invalid',
            details: manifestUrl
        };
    }
}

export function buildRunPreflight(form: RunFormState): {
    checks: RunPreflightCheck[];
    summary: RunPreflightSummary;
} {
    const checks: RunPreflightCheck[] = [
        buildInputPathCheck(form),
        buildDirectoryCheck('outputPath', 'Build directory', form.outputPath, path.resolve(process.cwd(), 'build')),
        buildDirectoryCheck('reportDir', 'Reports directory', form.reportDir, path.resolve(process.cwd(), 'reports')),
        buildServerDirNameCheck(form),
        buildRunIdPrefixCheck(form),
        buildValidationCheck(form),
        buildRegistryCheck(form)
    ];
    const errors = checks.filter((check) => check.severity === 'error').length;
    const warnings = checks.filter((check) => check.severity === 'warning').length;
    const ok = checks.length - errors - warnings;

    return {
        checks,
        summary: {
            total: checks.length,
            errors,
            warnings,
            ok,
            canRun: errors === 0
        }
    };
}
