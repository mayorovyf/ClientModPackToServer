const { createDefaultRunFormState } = require('../tui/state/app-state');

import type { CliOptions } from '../types/config';
import type { RunFormState } from '../tui/state/app-state.js';
import type { RunPreset } from '../tui/state/presets.js';

function splitEngineNames(value: string): string[] {
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

export function applyCliOptionsToRunForm(cliOptions: CliOptions, baseForm?: RunFormState): RunFormState {
    const initialForm = baseForm ? { ...baseForm } : createDefaultRunFormState();

    if (cliOptions.inputPath !== null && cliOptions.inputPath !== undefined) {
        initialForm.inputPath = cliOptions.inputPath;
    }

    if (cliOptions.outputPath !== null && cliOptions.outputPath !== undefined) {
        initialForm.outputPath = cliOptions.outputPath;
    }

    if (cliOptions.serverDirName !== null && cliOptions.serverDirName !== undefined) {
        initialForm.serverDirName = cliOptions.serverDirName;
    }

    if (cliOptions.reportDir !== null && cliOptions.reportDir !== undefined) {
        initialForm.reportDir = cliOptions.reportDir;
    }

    if (cliOptions.runIdPrefix !== null && cliOptions.runIdPrefix !== undefined) {
        initialForm.runIdPrefix = cliOptions.runIdPrefix;
    }

    if (cliOptions.arbiterProfile) {
        initialForm.profile = cliOptions.arbiterProfile;
    }

    if (cliOptions.deepCheckMode) {
        initialForm.deepCheckMode = cliOptions.deepCheckMode;
    }

    if (cliOptions.validationMode) {
        initialForm.validationMode = cliOptions.validationMode;
    }

    if (cliOptions.validationTimeoutMs !== null && cliOptions.validationTimeoutMs !== undefined) {
        initialForm.validationTimeoutMs = String(cliOptions.validationTimeoutMs);
    }

    if (cliOptions.validationEntrypointPath !== null && cliOptions.validationEntrypointPath !== undefined) {
        initialForm.validationEntrypointPath = cliOptions.validationEntrypointPath;
    }

    if (cliOptions.registryMode) {
        initialForm.registryMode = cliOptions.registryMode;
    }

    if (cliOptions.registryManifestUrl !== null && cliOptions.registryManifestUrl !== undefined) {
        initialForm.registryManifestUrl = cliOptions.registryManifestUrl;
    }

    if (cliOptions.registryBundleUrl !== null && cliOptions.registryBundleUrl !== undefined) {
        initialForm.registryBundleUrl = cliOptions.registryBundleUrl;
    }

    if (cliOptions.registryFilePath !== null && cliOptions.registryFilePath !== undefined) {
        initialForm.registryFilePath = cliOptions.registryFilePath;
    }

    if (cliOptions.registryOverridesPath !== null && cliOptions.registryOverridesPath !== undefined) {
        initialForm.registryOverridesPath = cliOptions.registryOverridesPath;
    }

    if (Array.isArray(cliOptions.engineNames) && cliOptions.engineNames.length > 0) {
        initialForm.enabledEngineNames = cliOptions.engineNames.join(', ');
    }

    if (Array.isArray(cliOptions.disabledEngineNames) && cliOptions.disabledEngineNames.length > 0) {
        initialForm.disabledEngineNames = cliOptions.disabledEngineNames.join(', ');
    }

    if (cliOptions.dryRun) {
        initialForm.dryRun = true;
    }

    if (cliOptions.validationSaveArtifacts) {
        initialForm.validationSaveArtifacts = true;
    }

    return initialForm;
}

export function runFormToCliOptions(form: RunFormState): CliOptions {
    return {
        inputPath: form.inputPath.trim() || null,
        outputPath: form.outputPath.trim() || null,
        serverDirName: form.serverDirName.trim() || null,
        reportDir: form.reportDir.trim() || null,
        runIdPrefix: form.runIdPrefix.trim() || null,
        mode: form.dryRun ? 'analyze' : 'build',
        registryFilePath: form.registryFilePath.trim() || null,
        registryOverridesPath: form.registryOverridesPath.trim() || null,
        registryMode: form.registryMode,
        registryManifestUrl: form.registryManifestUrl.trim() || null,
        registryBundleUrl: form.registryBundleUrl.trim() || null,
        arbiterProfile: form.profile,
        deepCheckMode: form.deepCheckMode,
        validationMode: form.validationMode,
        validationTimeoutMs: form.validationTimeoutMs.trim() || null,
        validationEntrypointPath: form.validationEntrypointPath.trim() || null,
        validationSaveArtifacts: form.validationSaveArtifacts,
        engineNames: splitEngineNames(form.enabledEngineNames),
        disabledEngineNames: splitEngineNames(form.disabledEngineNames),
        dryRun: form.dryRun,
        help: false
    };
}

export function mergeCliOptions(baseOptions: CliOptions, overrideOptions: CliOptions): CliOptions {
    return {
        inputPath: overrideOptions.inputPath ?? baseOptions.inputPath ?? null,
        outputPath: overrideOptions.outputPath ?? baseOptions.outputPath ?? null,
        serverDirName: overrideOptions.serverDirName ?? baseOptions.serverDirName ?? null,
        reportDir: overrideOptions.reportDir ?? baseOptions.reportDir ?? null,
        runIdPrefix: overrideOptions.runIdPrefix ?? baseOptions.runIdPrefix ?? null,
        outputPolicy: overrideOptions.outputPolicy ?? baseOptions.outputPolicy ?? null,
        mode: overrideOptions.mode ?? baseOptions.mode ?? null,
        registryFilePath: overrideOptions.registryFilePath ?? baseOptions.registryFilePath ?? null,
        registryOverridesPath: overrideOptions.registryOverridesPath ?? baseOptions.registryOverridesPath ?? null,
        registryMode: overrideOptions.registryMode ?? baseOptions.registryMode ?? null,
        registryManifestUrl: overrideOptions.registryManifestUrl ?? baseOptions.registryManifestUrl ?? null,
        registryBundleUrl: overrideOptions.registryBundleUrl ?? baseOptions.registryBundleUrl ?? null,
        arbiterProfile: overrideOptions.arbiterProfile ?? baseOptions.arbiterProfile ?? null,
        deepCheckMode: overrideOptions.deepCheckMode ?? baseOptions.deepCheckMode ?? null,
        validationMode: overrideOptions.validationMode ?? baseOptions.validationMode ?? null,
        validationTimeoutMs: overrideOptions.validationTimeoutMs ?? baseOptions.validationTimeoutMs ?? null,
        validationEntrypointPath: overrideOptions.validationEntrypointPath ?? baseOptions.validationEntrypointPath ?? null,
        validationSaveArtifacts: Boolean(baseOptions.validationSaveArtifacts || overrideOptions.validationSaveArtifacts),
        engineNames: overrideOptions.engineNames && overrideOptions.engineNames.length > 0
            ? overrideOptions.engineNames
            : baseOptions.engineNames ?? [],
        disabledEngineNames: overrideOptions.disabledEngineNames && overrideOptions.disabledEngineNames.length > 0
            ? overrideOptions.disabledEngineNames
            : baseOptions.disabledEngineNames ?? [],
        dryRun: Boolean(baseOptions.dryRun || overrideOptions.dryRun),
        help: Boolean(baseOptions.help || overrideOptions.help)
    };
}

export function findRunPreset(presets: RunPreset[], selector: string): RunPreset | null {
    const normalizedSelector = String(selector || '').trim();

    if (!normalizedSelector) {
        return null;
    }

    return presets.find((preset) => preset.id === normalizedSelector)
        || presets.find((preset) => preset.name.toLowerCase() === normalizedSelector.toLowerCase())
        || null;
}

export function summarizeRunPreset(preset: RunPreset): string {
    return `${preset.form.profile} | ${preset.form.deepCheckMode} | ${preset.form.validationMode} | ${preset.form.dryRun ? 'dry-run' : 'build'}`;
}
