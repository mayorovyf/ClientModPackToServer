const { RunConfigurationError } = require('../core/errors');

const VALUE_FLAGS = new Set([
    '--input',
    '--output',
    '--report-dir',
    '--mode',
    '--registry-file',
    '--registry-overrides',
    '--registry-mode',
    '--registry-manifest-url',
    '--registry-bundle-url',
    '--profile',
    '--deep-check',
    '--validation',
    '--validation-timeout-ms',
    '--validation-entrypoint'
]);
const MULTI_VALUE_FLAGS = new Set(['--engine', '--disable-engine']);
const BOOLEAN_FLAGS = new Set(['--dry-run', '--help', '--validation-save-artifacts']);

function splitFlag(token) {
    const eqIndex = token.indexOf('=');

    if (eqIndex === -1) {
        return { key: token, value: null };
    }

    return {
        key: token.slice(0, eqIndex),
        value: token.slice(eqIndex + 1)
    };
}

function pushMultiValues(target, value) {
    for (const item of String(value || '').split(',')) {
        const normalized = item.trim();

        if (normalized) {
            target.push(normalized);
        }
    }
}

function parseCliArgs(argv = []) {
    const options = {
        inputPath: null,
        outputPath: null,
        reportDir: null,
        mode: null,
        registryFilePath: null,
        registryOverridesPath: null,
        registryMode: null,
        registryManifestUrl: null,
        registryBundleUrl: null,
        arbiterProfile: null,
        deepCheckMode: null,
        validationMode: null,
        validationTimeoutMs: null,
        validationEntrypointPath: null,
        validationSaveArtifacts: false,
        engineNames: [],
        disabledEngineNames: [],
        dryRun: false,
        help: false
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        const { key, value } = splitFlag(token);

        if (BOOLEAN_FLAGS.has(key)) {
            if (key === '--dry-run') {
                options.dryRun = true;
            }

            if (key === '--help') {
                options.help = true;
            }

            if (key === '--validation-save-artifacts') {
                options.validationSaveArtifacts = true;
            }

            continue;
        }

        if (!VALUE_FLAGS.has(key) && !MULTI_VALUE_FLAGS.has(key)) {
            throw new RunConfigurationError(`Unknown argument: ${token}`);
        }

        const resolvedValue = value !== null ? value : argv[index + 1];

        if (!resolvedValue || resolvedValue.startsWith('--')) {
            throw new RunConfigurationError(`Argument ${key} requires a value`);
        }

        if (value === null) {
            index += 1;
        }

        if (MULTI_VALUE_FLAGS.has(key)) {
            if (key === '--engine') {
                pushMultiValues(options.engineNames, resolvedValue);
            } else if (key === '--disable-engine') {
                pushMultiValues(options.disabledEngineNames, resolvedValue);
            }

            continue;
        }

        switch (key) {
            case '--input':
                options.inputPath = resolvedValue;
                break;
            case '--output':
                options.outputPath = resolvedValue;
                break;
            case '--report-dir':
                options.reportDir = resolvedValue;
                break;
            case '--mode':
                options.mode = resolvedValue;
                break;
            case '--registry-file':
                options.registryFilePath = resolvedValue;
                break;
            case '--registry-overrides':
                options.registryOverridesPath = resolvedValue;
                break;
            case '--registry-mode':
                options.registryMode = resolvedValue;
                break;
            case '--registry-manifest-url':
                options.registryManifestUrl = resolvedValue;
                break;
            case '--registry-bundle-url':
                options.registryBundleUrl = resolvedValue;
                break;
            case '--profile':
                options.arbiterProfile = resolvedValue;
                break;
            case '--deep-check':
                options.deepCheckMode = resolvedValue;
                break;
            case '--validation':
                options.validationMode = resolvedValue;
                break;
            case '--validation-timeout-ms':
                options.validationTimeoutMs = resolvedValue;
                break;
            case '--validation-entrypoint':
                options.validationEntrypointPath = resolvedValue;
                break;
            default:
                throw new RunConfigurationError(`Argument is not supported: ${key}`);
        }
    }

    return options;
}

function printHelp(logger) {
    logger.raw('Usage:');
    logger.raw('  node index.js [--input <path>] [--output <dir>] [--report-dir <dir>] [--dry-run] [--mode <build|analyze>]');
    logger.raw('                [--engine <name>] [--disable-engine <name>] [--registry-file <path>] [--registry-overrides <path>]');
    logger.raw('                [--registry-mode <auto|offline|refresh|pinned>] [--registry-manifest-url <url>] [--registry-bundle-url <url>]');
    logger.raw('                [--profile <safe|balanced|aggressive>] [--deep-check <auto|off|force>]');
    logger.raw('                [--validation <off|auto|require|force>] [--validation-timeout-ms <ms>] [--validation-entrypoint <path>]');
    logger.raw('                [--validation-save-artifacts]');
    logger.raw('');
    logger.raw('Options:');
    logger.raw('  --input            Path to the mods directory');
    logger.raw('  --output           Root directory for build results');
    logger.raw('  --report-dir       Root directory for run reports');
    logger.raw('  --dry-run          Analyze only and write reports without creating build output');
    logger.raw('  --mode             build or analyze');
    logger.raw('  --engine           Enable a classification engine (repeatable)');
    logger.raw('  --disable-engine   Disable a classification engine (repeatable)');
    logger.raw('  --registry-file    Path to a local registry JSON file');
    logger.raw('  --registry-overrides Path to a local overrides JSON file');
    logger.raw('  --registry-mode    Registry runtime mode: auto, offline, refresh, or pinned');
    logger.raw('  --registry-manifest-url URL of remote manifest.json');
    logger.raw('  --registry-bundle-url Override URL of remote registry bundle');
    logger.raw('  --profile          Arbiter profile: safe, balanced, or aggressive');
    logger.raw('  --deep-check       Deep-check mode: auto, off, or force');
    logger.raw('  --validation       Validation mode: off, auto, require, or force');
    logger.raw('  --validation-timeout-ms Timeout in milliseconds for smoke-test');
    logger.raw('  --validation-entrypoint Explicit path to server launcher for smoke-test');
    logger.raw('  --validation-save-artifacts Save validation stdout/stderr artifacts into report dir');
    logger.raw('  --help             Show this help');
}

module.exports = {
    parseCliArgs,
    printHelp
};
