import { createRequire } from 'node:module';
import type { BackendEvent } from '../../types/events.js';
import type { RunReport } from '../../types/report.js';
import type { MessageKey } from '../../i18n/catalog.js';

const require = createRequire(import.meta.url);
const { DEFAULT_REMOTE_REGISTRY_MANIFEST_URL } = require('../../registry/constants.js');

export type TuiMode = 'simple' | 'expert';
export type ScreenId = 'build' | 'server' | 'results' | 'settings';
export type BuildPageId = 'paths' | 'strategy' | 'check' | 'launch' | 'presets';
export type ServerPageId = 'setup' | 'install' | 'doctor' | 'launch' | 'logs';
export type ResultsPageId = 'overview' | 'problems' | 'compare' | 'reports';
export type SettingsPageId = 'general' | 'registry' | 'about';
export type RunSessionStatus = 'idle' | 'running' | 'succeeded' | 'failed';
export type FocusedColumn = 'sidebar' | 'content' | 'details';
export type RegistryMode = 'auto' | 'offline' | 'refresh' | 'pinned';
export type ProfileMode = 'safe' | 'balanced' | 'aggressive';
export type DeepCheckMode = 'auto' | 'off' | 'force';
export type ValidationMode = 'off' | 'auto' | 'require' | 'force';
export type ServerCoreType = 'fabric' | 'forge' | 'neoforge';

export interface SectionPageMap {
    build: BuildPageId;
    server: ServerPageId;
    results: ResultsPageId;
    settings: SettingsPageId;
}

export type ActivePageByScreen = {
    [K in ScreenId]: SectionPageMap[K];
};

export interface NavigationItem {
    id: ScreenId;
    labelKey: MessageKey;
    descriptionKey: MessageKey;
}

export interface RunFormState {
    inputPath: string;
    outputPath: string;
    serverDirName: string;
    reportDir: string;
    runIdPrefix: string;
    dryRun: boolean;
    profile: ProfileMode;
    deepCheckMode: DeepCheckMode;
    validationMode: ValidationMode;
    validationTimeoutMs: string;
    validationEntrypointPath: string;
    validationSaveArtifacts: boolean;
    registryMode: RegistryMode;
    registryManifestUrl: string;
    registryBundleUrl: string;
    registryFilePath: string;
    registryOverridesPath: string;
    enabledEngineNames: string;
    disabledEngineNames: string;
}

export interface ServerFormState {
    targetDir: string;
    coreType: ServerCoreType;
    minecraftVersion: string;
    loaderVersion: string;
    javaPath: string;
    jvmArgs: string;
    explicitEntrypointPath: string;
    acceptEula: boolean;
}

export interface ReportPathsState {
    reportDir: string | null;
    jsonReportPath: string | null;
    summaryPath: string | null;
    eventsLogPath: string | null;
}

export interface RunSessionState {
    status: RunSessionStatus;
    runId: string | null;
    currentStage: string | null;
    lastError: string | null;
    reportPaths: ReportPathsState;
    registrySnapshot: Record<string, unknown> | null;
    validationSnapshot: Record<string, unknown> | null;
    buildSnapshot: Record<string, unknown> | null;
    stageSummaries: Record<string, unknown>;
    events: BackendEvent[];
    lastReport: RunReport | null;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
    { id: 'build', labelKey: 'nav.build.label', descriptionKey: 'nav.build.description' },
    { id: 'results', labelKey: 'nav.results.label', descriptionKey: 'nav.results.description' },
    { id: 'server', labelKey: 'nav.server.label', descriptionKey: 'nav.server.description' },
    { id: 'settings', labelKey: 'nav.settings.label', descriptionKey: 'nav.settings.description' }
];

export const PAGE_ORDER_BY_SCREEN: { [K in ScreenId]: readonly SectionPageMap[K][] } = {
    build: ['paths', 'strategy', 'check', 'launch', 'presets'],
    server: ['setup', 'install', 'doctor', 'launch', 'logs'],
    results: ['reports', 'overview', 'problems', 'compare'],
    settings: ['general', 'registry', 'about']
};

export function createDefaultActivePageByScreen(): ActivePageByScreen {
    return {
        build: 'paths',
        server: 'setup',
        results: 'reports',
        settings: 'general'
    };
}

export function createDefaultRunFormState(): RunFormState {
    return {
        inputPath: '',
        outputPath: '',
        serverDirName: '',
        reportDir: '',
        runIdPrefix: '',
        dryRun: false,
        profile: 'balanced',
        deepCheckMode: 'auto',
        validationMode: 'auto',
        validationTimeoutMs: '',
        validationEntrypointPath: '',
        validationSaveArtifacts: false,
        registryMode: 'auto',
        registryManifestUrl: DEFAULT_REMOTE_REGISTRY_MANIFEST_URL,
        registryBundleUrl: '',
        registryFilePath: '',
        registryOverridesPath: '',
        enabledEngineNames: '',
        disabledEngineNames: ''
    };
}

export function createDefaultServerFormState(): ServerFormState {
    return {
        targetDir: '',
        coreType: 'fabric',
        minecraftVersion: '',
        loaderVersion: '',
        javaPath: '',
        jvmArgs: '',
        explicitEntrypointPath: '',
        acceptEula: false
    };
}

export function createInitialRunSessionState(): RunSessionState {
    return {
        status: 'idle',
        runId: null,
        currentStage: null,
        lastError: null,
        reportPaths: {
            reportDir: null,
            jsonReportPath: null,
            summaryPath: null,
            eventsLogPath: null
        },
        registrySnapshot: null,
        validationSnapshot: null,
        buildSnapshot: null,
        stageSummaries: {},
        events: [],
        lastReport: null
    };
}

export function createRunningSessionState(): RunSessionState {
    return {
        ...createInitialRunSessionState(),
        status: 'running'
    };
}

export function toggleTuiMode(mode: TuiMode): TuiMode {
    return mode === 'simple' ? 'expert' : 'simple';
}

export function cycleOption<T extends string>(currentValue: T, values: readonly T[]): T {
    const currentIndex = values.indexOf(currentValue);
    const firstValue = values[0];

    if (!firstValue) {
        return currentValue;
    }

    if (currentIndex === -1 || currentIndex === values.length - 1) {
        return firstValue;
    }

    return values[currentIndex + 1] ?? firstValue;
}

export function appendBackendEvent(events: BackendEvent[], event: BackendEvent): BackendEvent[] {
    const nextEvents = [...events, event];
    return nextEvents.slice(-1000);
}

export function applyBackendEvent(session: RunSessionState, event: BackendEvent): RunSessionState {
    const nextSession: RunSessionState = {
        ...session,
        events: appendBackendEvent(session.events, event)
    };

    if (event.runId) {
        nextSession.runId = event.runId;
    }

    switch (event.type) {
        case 'run.started':
            nextSession.status = 'running';
            nextSession.lastError = null;
            break;
        case 'stage.started':
            nextSession.currentStage = String(event.payload.stage || '');
            break;
        case 'stage.completed':
            nextSession.currentStage = String(event.payload.stage || nextSession.currentStage || '');
            nextSession.stageSummaries = {
                ...nextSession.stageSummaries,
                [String(event.payload.stage || 'unknown')]: event.payload.summary || event.payload
            };
            break;
        case 'registry.loaded':
            nextSession.registrySnapshot = event.payload;
            break;
        case 'validation.completed':
            nextSession.validationSnapshot = event.payload;
            break;
        case 'build.action.completed':
            nextSession.buildSnapshot = event.payload;
            break;
        case 'report.written':
            nextSession.reportPaths = {
                reportDir: typeof event.payload.reportDir === 'string' ? event.payload.reportDir : null,
                jsonReportPath: typeof event.payload.jsonReportPath === 'string' ? event.payload.jsonReportPath : null,
                summaryPath: typeof event.payload.summaryPath === 'string' ? event.payload.summaryPath : null,
                eventsLogPath: typeof event.payload.eventsLogPath === 'string' ? event.payload.eventsLogPath : null
            };
            break;
        case 'run.finished':
            nextSession.status = 'succeeded';
            nextSession.currentStage = null;
            break;
        case 'run.failed':
            nextSession.status = 'failed';
            nextSession.currentStage = null;
            nextSession.lastError = typeof event.payload.message === 'string' ? event.payload.message : 'Run failed';
            break;
        default:
            break;
    }

    return nextSession;
}
