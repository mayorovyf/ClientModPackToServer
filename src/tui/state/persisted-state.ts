import fs from 'node:fs';
import path from 'node:path';

import { createDefaultActivePageByScreen, createDefaultRunFormState, createDefaultServerFormState, PAGE_ORDER_BY_SCREEN } from './app-state.js';

import type { ActivePageByScreen, RunFormState, ScreenId, ServerFormState, TuiMode } from './app-state.js';

export interface PersistedTuiState {
    version: 2;
    activeScreen: ScreenId;
    activePageByScreen: ActivePageByScreen;
    uiMode: TuiMode;
    showHints: boolean;
    form: RunFormState;
    serverForm: ServerFormState;
}

const VALID_SCREENS: ScreenId[] = ['build', 'presets', 'server', 'registry', 'reports', 'review', 'settings', 'authors'];
const VALID_UI_MODES: TuiMode[] = ['simple', 'expert'];
const DEFAULT_TUI_SETTINGS_PATH = path.resolve(process.cwd(), 'data', 'tui-settings.json');

function createDefaultPersistedTuiState(): PersistedTuiState {
    return {
        version: 2,
        activeScreen: 'build',
        activePageByScreen: createDefaultActivePageByScreen(),
        uiMode: 'simple',
        showHints: true,
        form: createDefaultRunFormState(),
        serverForm: createDefaultServerFormState()
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

function normalizeActivePageByScreen(value: unknown): ActivePageByScreen {
    const defaults = createDefaultActivePageByScreen();
    const candidate = value && typeof value === 'object' ? (value as Partial<Record<ScreenId, string>>) : {};
    const pages = { ...defaults } as ActivePageByScreen;
    const mutablePages = pages as Record<ScreenId, string>;

    for (const screenId of VALID_SCREENS) {
        const allowedPages = PAGE_ORDER_BY_SCREEN[screenId] as readonly string[];
        const nextPage = candidate[screenId];

        mutablePages[screenId] = allowedPages.includes(String(nextPage))
            ? String(nextPage)
            : String(defaults[screenId]);
    }

    return pages;
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

function normalizeServerFormState(value: unknown): ServerFormState {
    const defaults = createDefaultServerFormState();
    const candidate = value && typeof value === 'object' ? (value as Partial<ServerFormState>) : {};

    return {
        targetDir: normalizeString(candidate.targetDir),
        coreType: candidate.coreType === 'forge' || candidate.coreType === 'neoforge' ? candidate.coreType : defaults.coreType,
        minecraftVersion: normalizeString(candidate.minecraftVersion),
        loaderVersion: normalizeString(candidate.loaderVersion),
        javaPath: normalizeString(candidate.javaPath),
        jvmArgs: normalizeString(candidate.jvmArgs),
        explicitEntrypointPath: normalizeString(candidate.explicitEntrypointPath),
        acceptEula: normalizeBoolean(candidate.acceptEula, defaults.acceptEula)
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
            version: 2,
            activeScreen: normalizeScreenId(parsed.activeScreen),
            activePageByScreen: normalizeActivePageByScreen(parsed.activePageByScreen),
            uiMode: normalizeTuiMode(parsed.uiMode),
            showHints: normalizeBoolean(parsed.showHints, defaults.showHints),
            form: normalizeRunFormState(parsed.form),
            serverForm: normalizeServerFormState(parsed.serverForm)
        };
    } catch {
        return defaults;
    }
}

export function savePersistedTuiState(state: PersistedTuiState): void {
    const normalizedState: PersistedTuiState = {
        version: 2,
        activeScreen: normalizeScreenId(state.activeScreen),
        activePageByScreen: normalizeActivePageByScreen(state.activePageByScreen),
        uiMode: normalizeTuiMode(state.uiMode),
        showHints: normalizeBoolean(state.showHints, true),
        form: normalizeRunFormState(state.form),
        serverForm: normalizeServerFormState(state.serverForm)
    };
    const directoryPath = path.dirname(DEFAULT_TUI_SETTINGS_PATH);

    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }

    fs.writeFileSync(DEFAULT_TUI_SETTINGS_PATH, `${JSON.stringify(normalizedState, null, 2)}\n`, 'utf8');
}
