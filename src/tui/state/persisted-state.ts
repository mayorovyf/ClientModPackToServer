import fs from 'node:fs';
import path from 'node:path';

import { createDefaultRunFormState } from './app-state.js';

import type { RunFormState, ScreenId, TuiMode } from './app-state.js';

export interface PersistedTuiState {
    version: 1;
    activeScreen: ScreenId;
    uiMode: TuiMode;
    showHints: boolean;
    form: RunFormState;
}

const VALID_SCREENS: ScreenId[] = ['build', 'registry', 'reports', 'review', 'settings', 'authors'];
const VALID_UI_MODES: TuiMode[] = ['simple', 'expert'];
const DEFAULT_TUI_SETTINGS_PATH = path.resolve(process.cwd(), 'data', 'tui-settings.json');

function createDefaultPersistedTuiState(): PersistedTuiState {
    return {
        version: 1,
        activeScreen: 'build',
        uiMode: 'simple',
        showHints: true,
        form: createDefaultRunFormState()
    };
}

function normalizeScreenId(value: unknown): ScreenId {
    return VALID_SCREENS.includes(value as ScreenId) ? (value as ScreenId) : 'build';
}

function normalizeTuiMode(value: unknown): TuiMode {
    return VALID_UI_MODES.includes(value as TuiMode) ? (value as TuiMode) : 'simple';
}

function normalizeString(value: unknown): string {
    return typeof value === 'string' ? value : '';
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
        registryManifestUrl: normalizeString(candidate.registryManifestUrl),
        registryBundleUrl: normalizeString(candidate.registryBundleUrl),
        registryFilePath: normalizeString(candidate.registryFilePath),
        registryOverridesPath: normalizeString(candidate.registryOverridesPath),
        enabledEngineNames: normalizeString(candidate.enabledEngineNames),
        disabledEngineNames: normalizeString(candidate.disabledEngineNames)
    };
}

export function getPersistedTuiStatePath(): string {
    return DEFAULT_TUI_SETTINGS_PATH;
}

export function loadPersistedTuiState(): PersistedTuiState {
    const defaults = createDefaultPersistedTuiState();

    try {
        if (!fs.existsSync(DEFAULT_TUI_SETTINGS_PATH)) {
            return defaults;
        }

        const parsed = JSON.parse(fs.readFileSync(DEFAULT_TUI_SETTINGS_PATH, 'utf8')) as Partial<PersistedTuiState>;

        return {
            version: 1,
            activeScreen: normalizeScreenId(parsed.activeScreen),
            uiMode: normalizeTuiMode(parsed.uiMode),
            showHints: normalizeBoolean(parsed.showHints, defaults.showHints),
            form: normalizeRunFormState(parsed.form)
        };
    } catch {
        return defaults;
    }
}

export function savePersistedTuiState(state: PersistedTuiState): void {
    const normalizedState: PersistedTuiState = {
        version: 1,
        activeScreen: normalizeScreenId(state.activeScreen),
        uiMode: normalizeTuiMode(state.uiMode),
        showHints: normalizeBoolean(state.showHints, true),
        form: normalizeRunFormState(state.form)
    };
    const directoryPath = path.dirname(DEFAULT_TUI_SETTINGS_PATH);

    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }

    fs.writeFileSync(DEFAULT_TUI_SETTINGS_PATH, `${JSON.stringify(normalizedState, null, 2)}\n`, 'utf8');
}
