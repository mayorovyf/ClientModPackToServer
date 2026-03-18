const VALIDATION_MODES = Object.freeze({
    off: 'off',
    auto: 'auto',
    require: 'require',
    force: 'force'
});

const VALIDATION_STATUSES = Object.freeze({
    notRun: 'not-run',
    passed: 'passed',
    failed: 'failed',
    timedOut: 'timed-out',
    error: 'error',
    skipped: 'skipped'
});

const DEFAULT_VALIDATION_TIMEOUT_MS = 15000;

const DEFAULT_VALIDATION_LOG_FILE_NAME = 'validation.log';
const DEFAULT_VALIDATION_STDOUT_FILE_NAME = 'validation-stdout.log';
const DEFAULT_VALIDATION_STDERR_FILE_NAME = 'validation-stderr.log';

function normalizeValidationMode(mode) {
    const normalized = String(mode || '').trim().toLowerCase();

    if (!normalized) {
        return null;
    }

    if (Object.prototype.hasOwnProperty.call(VALIDATION_MODES, normalized)) {
        return VALIDATION_MODES[normalized];
    }

    return null;
}

module.exports = {
    DEFAULT_VALIDATION_LOG_FILE_NAME,
    DEFAULT_VALIDATION_STDERR_FILE_NAME,
    DEFAULT_VALIDATION_STDOUT_FILE_NAME,
    DEFAULT_VALIDATION_TIMEOUT_MS,
    VALIDATION_MODES,
    VALIDATION_STATUSES,
    normalizeValidationMode
};
