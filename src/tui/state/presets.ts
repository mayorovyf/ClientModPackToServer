import fs from 'node:fs';
import path from 'node:path';

import { createDefaultRunFormState } from './app-state.js';

import type { RunFormState } from './app-state.js';

export interface RunPreset {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    form: RunFormState;
}

interface RunPresetFile {
    version: 1;
    presets: RunPreset[];
}

const DEFAULT_PRESET_STORAGE_PATH = path.resolve(process.cwd(), 'data', 'run-presets.json');

function normalizeString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function normalizeStringWithDefault(value: unknown, fallback: string): string {
    if (typeof value !== 'string') {
        return fallback;
    }

    const normalized = value.trim();
    return normalized ? value : fallback;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function normalizeRunFormState(value: unknown): RunFormState {
    const defaults = createDefaultRunFormState();
    const candidate = value && typeof value === 'object' ? (value as Partial<RunFormState>) : {};

    return {
        inputPath: normalizeString(candidate.inputPath),
        outputPath: normalizeString(candidate.outputPath),
        serverDirName: normalizeString(candidate.serverDirName),
        reportDir: normalizeString(candidate.reportDir),
        runIdPrefix: normalizeString(candidate.runIdPrefix),
        dryRun: normalizeBoolean(candidate.dryRun, defaults.dryRun),
        profile: candidate.profile === 'safe' || candidate.profile === 'aggressive' ? candidate.profile : defaults.profile,
        deepCheckMode: candidate.deepCheckMode === 'off' || candidate.deepCheckMode === 'force' ? candidate.deepCheckMode : defaults.deepCheckMode,
        validationMode: candidate.validationMode === 'off'
            || candidate.validationMode === 'require'
            || candidate.validationMode === 'force'
            ? candidate.validationMode
            : defaults.validationMode,
        validationTimeoutMs: normalizeString(candidate.validationTimeoutMs),
        validationEntrypointPath: normalizeString(candidate.validationEntrypointPath),
        validationSaveArtifacts: normalizeBoolean(candidate.validationSaveArtifacts, defaults.validationSaveArtifacts),
        registryMode: candidate.registryMode === 'offline'
            || candidate.registryMode === 'refresh'
            || candidate.registryMode === 'pinned'
            ? candidate.registryMode
            : defaults.registryMode,
        registryManifestUrl: normalizeStringWithDefault(candidate.registryManifestUrl, defaults.registryManifestUrl),
        registryBundleUrl: normalizeString(candidate.registryBundleUrl),
        registryFilePath: normalizeString(candidate.registryFilePath),
        registryOverridesPath: normalizeString(candidate.registryOverridesPath),
        enabledEngineNames: normalizeString(candidate.enabledEngineNames),
        disabledEngineNames: normalizeString(candidate.disabledEngineNames)
    };
}

function createPresetId(): string {
    return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePreset(candidate: unknown): RunPreset | null {
    if (!candidate || typeof candidate !== 'object') {
        return null;
    }

    const preset = candidate as Partial<RunPreset>;
    const name = normalizeString(preset.name).trim();

    if (!name) {
        return null;
    }

    return {
        id: normalizeString(preset.id).trim() || createPresetId(),
        name,
        createdAt: normalizeString(preset.createdAt) || new Date(0).toISOString(),
        updatedAt: normalizeString(preset.updatedAt) || new Date(0).toISOString(),
        form: normalizeRunFormState(preset.form)
    };
}

function readPresetFile(): RunPresetFile {
    try {
        if (!fs.existsSync(DEFAULT_PRESET_STORAGE_PATH)) {
            return {
                version: 1,
                presets: []
            };
        }

        const parsed = JSON.parse(fs.readFileSync(DEFAULT_PRESET_STORAGE_PATH, 'utf8')) as Partial<RunPresetFile>;
        const presets = Array.isArray(parsed.presets)
            ? parsed.presets.map((preset) => normalizePreset(preset)).filter((preset): preset is RunPreset => preset !== null)
            : [];

        return {
            version: 1,
            presets
        };
    } catch {
        return {
            version: 1,
            presets: []
        };
    }
}

function writePresetFile(file: RunPresetFile): void {
    const directoryPath = path.dirname(DEFAULT_PRESET_STORAGE_PATH);

    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }

    fs.writeFileSync(DEFAULT_PRESET_STORAGE_PATH, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
}

export function getRunPresetStoragePath(): string {
    return DEFAULT_PRESET_STORAGE_PATH;
}

export function loadRunPresets(): RunPreset[] {
    return readPresetFile().presets
        .slice()
        .sort((left, right) => left.name.localeCompare(right.name, 'ru'));
}

export function saveRunPreset({
    id = null,
    name,
    form
}: {
    id?: string | null;
    name: string;
    form: RunFormState;
}): RunPreset {
    const normalizedName = String(name || '').trim();

    if (!normalizedName) {
        throw new Error('Preset name is required');
    }

    const file = readPresetFile();
    const now = new Date().toISOString();
    const existingIndex = id
        ? file.presets.findIndex((preset) => preset.id === id)
        : file.presets.findIndex((preset) => preset.name.toLowerCase() === normalizedName.toLowerCase());
    const existingPreset = existingIndex >= 0 ? file.presets[existingIndex] : null;
    const nextPreset: RunPreset = {
        id: existingPreset?.id || createPresetId(),
        name: normalizedName,
        createdAt: existingPreset?.createdAt || now,
        updatedAt: now,
        form: normalizeRunFormState(form)
    };

    if (existingIndex >= 0) {
        file.presets[existingIndex] = nextPreset;
    } else {
        file.presets.push(nextPreset);
    }

    writePresetFile(file);
    return nextPreset;
}

export function deleteRunPreset(id: string): boolean {
    const file = readPresetFile();
    const nextPresets = file.presets.filter((preset) => preset.id !== id);

    if (nextPresets.length === file.presets.length) {
        return false;
    }

    writePresetFile({
        version: 1,
        presets: nextPresets
    });
    return true;
}
