const path = require('path');

const { ARBITER_PROFILES } = require('../arbiter/constants');
const { normalizeArbiterProfile } = require('../arbiter/profiles');
const { DEFAULT_ENABLED_ENGINES } = require('../classification/constants');
const { getAvailableEngineNames } = require('../classification/engine-registry');
const { RunConfigurationError } = require('../core/errors');
const { DEEP_CHECK_MODES, normalizeDeepCheckMode } = require('../deep-check/constants');
const { DEFAULT_VALIDATION_TIMEOUT_MS, normalizeValidationMode } = require('../validation/constants');
const {
    DEFAULT_LOCAL_OVERRIDES_FILE_NAME,
    DEFAULT_LOCAL_REGISTRY_DIR_NAME,
    DEFAULT_LOCAL_REGISTRY_FILE_NAME,
    DEFAULT_REGISTRY_CACHE_DIR_NAME,
    DEFAULT_REGISTRY_CACHE_SUBDIR_NAME,
    DEFAULT_REGISTRY_FETCH_TIMEOUT_MS,
    REGISTRY_RUNTIME_MODES
} = require('../registry/constants');
const { assertRegistryMode } = require('../registry/runtime-source');
const { cleanInputPath } = require('../utils/path-utils');

const DEFAULT_CONFIG = Object.freeze({
    historyDirName: 'history',
    blockListFileName: 'block.txt',
    buildDirName: 'build',
    reportDirName: 'reports',
    tmpDirName: 'tmp',
    localRegistryFileName: DEFAULT_LOCAL_REGISTRY_FILE_NAME,
    localRegistryDirName: DEFAULT_LOCAL_REGISTRY_DIR_NAME,
    localOverridesFileName: DEFAULT_LOCAL_OVERRIDES_FILE_NAME,
    registryCacheDirName: DEFAULT_REGISTRY_CACHE_DIR_NAME,
    registryCacheSubDirName: DEFAULT_REGISTRY_CACHE_SUBDIR_NAME,
    outputPolicy: 'unique-run-dir',
    runIdPrefix: 'run',
    logLevel: process.env.CLIENT_TO_SERVER_LOG_LEVEL || 'info',
    useColors: process.env.NO_COLOR ? false : true,
    mode: 'build',
    outputFormat: 'text',
    interactive: true,
    dryRun: false,
    enabledEngines: DEFAULT_ENABLED_ENGINES,
    disabledEngines: [],
    dependencyValidationMode: 'conservative',
    arbiterProfile: ARBITER_PROFILES.balanced,
    deepCheckMode: DEEP_CHECK_MODES.auto,
    validationMode: 'auto',
    validationTimeoutMs: DEFAULT_VALIDATION_TIMEOUT_MS,
    registryMode: REGISTRY_RUNTIME_MODES.auto,
    registryManifestUrl: process.env.CLIENT_TO_SERVER_REGISTRY_MANIFEST_URL || null,
    registryBundleUrl: process.env.CLIENT_TO_SERVER_REGISTRY_BUNDLE_URL || null,
    registryFetchTimeoutMs: DEFAULT_REGISTRY_FETCH_TIMEOUT_MS
});

function normalizeMode(mode, dryRun) {
    if (dryRun) {
        return 'analyze';
    }

    if (!mode || mode === 'build') {
        return 'build';
    }

    if (mode === 'analyze' || mode === 'dry-run') {
        return 'analyze';
    }

    throw new RunConfigurationError(`Неизвестный режим запуска: ${mode}`);
}

function normalizeOutputPolicy(policy) {
    if (!policy || policy === DEFAULT_CONFIG.outputPolicy) {
        return DEFAULT_CONFIG.outputPolicy;
    }

    throw new RunConfigurationError(`Неизвестная политика output: ${policy}`);
}

function normalizeRunIdPrefix(prefix) {
    if (!prefix) {
        return DEFAULT_CONFIG.runIdPrefix;
    }

    const normalizedPrefix = String(prefix).trim().toLowerCase();

    if (!normalizedPrefix) {
        return DEFAULT_CONFIG.runIdPrefix;
    }

    if (!/^[a-z0-9-]+$/.test(normalizedPrefix)) {
        throw new RunConfigurationError('Префикс runId должен содержать только латинские буквы, цифры и дефисы');
    }

    return normalizedPrefix;
}

function resolveOptionalPath(value) {
    if (!value) {
        return null;
    }

    return path.resolve(cleanInputPath(value));
}

function normalizeOptionalUrl(value, optionLabel) {
    if (!value) {
        return null;
    }

    const normalized = String(value).trim();

    if (!normalized) {
        return null;
    }

    try {
        return new URL(normalized).toString();
    } catch (error) {
        throw new RunConfigurationError(`Некорректный URL в ${optionLabel}: ${value}`);
    }
}

function normalizeEngineList(engineNames, optionLabel) {
    const availableEngines = getAvailableEngineNames();
    const normalized = [...new Set((engineNames || []).map((name) => String(name || '').trim().toLowerCase()).filter(Boolean))];

    for (const engineName of normalized) {
        if (!availableEngines.includes(engineName)) {
            throw new RunConfigurationError(`Неизвестный движок в ${optionLabel}: ${engineName}`);
        }
    }

    return normalized;
}

function normalizeProfile(profile) {
    const normalized = normalizeArbiterProfile(profile);

    if (!normalized) {
        throw new RunConfigurationError(`Unknown arbiter profile: ${profile}`);
    }

    return normalized;
}

function normalizeDeepCheck(mode) {
    const normalized = normalizeDeepCheckMode(mode);

    if (!normalized) {
        throw new RunConfigurationError(`Unknown deep-check mode: ${mode}`);
    }

    return normalized;
}

function normalizeValidation(mode) {
    const normalized = normalizeValidationMode(mode);

    if (!normalized) {
        throw new RunConfigurationError(`Unknown validation mode: ${mode}`);
    }

    return normalized;
}

function normalizeValidationTimeout(value) {
    if (value === null || value === undefined || value === '') {
        return DEFAULT_CONFIG.validationTimeoutMs;
    }

    const normalized = Number(value);

    if (!Number.isInteger(normalized) || normalized <= 0) {
        throw new RunConfigurationError(`Invalid validation timeout: ${value}`);
    }

    return normalized;
}

function createRuntimeConfig({ scriptDir = process.cwd(), cliOptions = {} } = {}) {
    const mode = normalizeMode(cliOptions.mode || DEFAULT_CONFIG.mode, cliOptions.dryRun);
    const dryRun = Boolean(cliOptions.dryRun || mode === 'analyze');
    const inputPath = resolveOptionalPath(cliOptions.inputPath);
    const outputRootDir = resolveOptionalPath(cliOptions.outputPath) || path.join(scriptDir, DEFAULT_CONFIG.buildDirName);
    const reportRootDir = resolveOptionalPath(cliOptions.reportDir) || path.join(scriptDir, DEFAULT_CONFIG.reportDirName);
    const outputPolicy = normalizeOutputPolicy(cliOptions.outputPolicy || DEFAULT_CONFIG.outputPolicy);
    const runIdPrefix = normalizeRunIdPrefix(cliOptions.runIdPrefix || DEFAULT_CONFIG.runIdPrefix);
    const enabledEngines = cliOptions.engineNames && cliOptions.engineNames.length > 0
        ? normalizeEngineList(cliOptions.engineNames, '--engine')
        : [...DEFAULT_CONFIG.enabledEngines];
    const disabledEngines = normalizeEngineList(cliOptions.disabledEngineNames || [], '--disable-engine');
    const arbiterProfile = normalizeProfile(cliOptions.arbiterProfile || DEFAULT_CONFIG.arbiterProfile);
    const deepCheckMode = normalizeDeepCheck(cliOptions.deepCheckMode || DEFAULT_CONFIG.deepCheckMode);
    const validationMode = normalizeValidation(cliOptions.validationMode || DEFAULT_CONFIG.validationMode);
    const validationTimeoutMs = normalizeValidationTimeout(cliOptions.validationTimeoutMs || DEFAULT_CONFIG.validationTimeoutMs);
    const validationEntrypointPath = resolveOptionalPath(cliOptions.validationEntrypointPath);
    const validationSaveArtifacts = Boolean(cliOptions.validationSaveArtifacts);
    const registryMode = assertRegistryMode(cliOptions.registryMode || DEFAULT_CONFIG.registryMode);
    const registryManifestUrl = normalizeOptionalUrl(
        cliOptions.registryManifestUrl || DEFAULT_CONFIG.registryManifestUrl,
        '--registry-manifest-url'
    );
    const registryBundleUrl = normalizeOptionalUrl(
        cliOptions.registryBundleUrl || DEFAULT_CONFIG.registryBundleUrl,
        '--registry-bundle-url'
    );
    const registryFilePath = resolveOptionalPath(cliOptions.registryFilePath)
        || path.join(scriptDir, DEFAULT_CONFIG.localRegistryDirName, DEFAULT_CONFIG.localRegistryFileName);
    const localOverridesPath = resolveOptionalPath(cliOptions.registryOverridesPath)
        || path.join(scriptDir, DEFAULT_CONFIG.localRegistryDirName, DEFAULT_CONFIG.localOverridesFileName);
    const registryCacheDir = path.join(
        scriptDir,
        DEFAULT_CONFIG.registryCacheDirName,
        DEFAULT_CONFIG.registryCacheSubDirName
    );
    const tmpRootDir = path.join(scriptDir, DEFAULT_CONFIG.tmpDirName);

    if (registryBundleUrl && !registryManifestUrl) {
        throw new RunConfigurationError('Параметр --registry-bundle-url требует также указать --registry-manifest-url');
    }

    if (registryMode === REGISTRY_RUNTIME_MODES.refresh && !registryManifestUrl) {
        throw new RunConfigurationError('Режим --registry-mode refresh требует указать --registry-manifest-url');
    }

    return {
        ...DEFAULT_CONFIG,
        scriptDir,
        mode,
        dryRun,
        interactive: !inputPath,
        inputPath,
        outputRootDir,
        reportRootDir,
        tmpRootDir,
        outputPolicy,
        runIdPrefix,
        enabledEngines,
        disabledEngines,
        dependencyValidationMode: DEFAULT_CONFIG.dependencyValidationMode,
        arbiterProfile,
        deepCheckMode,
        validationMode,
        validationTimeoutMs,
        validationEntrypointPath,
        validationSaveArtifacts,
        registryMode,
        registryManifestUrl,
        registryBundleUrl,
        registryFetchTimeoutMs: DEFAULT_CONFIG.registryFetchTimeoutMs,
        registryCacheDir,
        registryFilePath,
        registryFileRequired: Boolean(cliOptions.registryFilePath),
        localOverridesPath,
        blockListPath: path.join(scriptDir, DEFAULT_CONFIG.blockListFileName),
        historyDir: path.join(scriptDir, DEFAULT_CONFIG.historyDirName)
    };
}

module.exports = {
    DEFAULT_CONFIG,
    createRuntimeConfig,
    normalizeEngineList,
    normalizeDeepCheck,
    normalizeMode,
    normalizeOutputPolicy,
    normalizeProfile,
    normalizeValidation,
    normalizeOptionalUrl,
    normalizeRunIdPrefix
};
