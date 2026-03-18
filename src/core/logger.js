const { colorize } = require('./colors');

const LOG_LEVELS = Object.freeze({
    debug: 10,
    info: 20,
    warn: 30,
    error: 40
});

function normalizeLogLevel(level) {
    return Object.prototype.hasOwnProperty.call(LOG_LEVELS, level) ? level : 'info';
}

class Logger {
    constructor({ useColors = true, level = 'info', context = '' } = {}) {
        this.useColors = useColors;
        this.level = normalizeLogLevel(level);
        this.context = context;
    }

    canLog(level) {
        return LOG_LEVELS[normalizeLogLevel(level)] >= LOG_LEVELS[this.level];
    }

    paint(text, color) {
        return colorize(text, color, { useColors: this.useColors });
    }

    formatMessage(message = '') {
        if (!message) {
            return '';
        }

        return this.context ? `${this.context} ${message}` : message;
    }

    raw(message = '') {
        console.log(this.formatMessage(message));
    }

    event(message, { label = '[INFO]', color = 'cyan', level = 'info' } = {}) {
        if (!this.canLog(level)) {
            return;
        }

        console.log(`${this.paint(label, color)} ${this.formatMessage(message)}`);
    }

    withContext(context) {
        const nextContext = this.context ? `${this.context} ${context}` : context;

        return new Logger({
            useColors: this.useColors,
            level: this.level,
            context: nextContext
        });
    }

    debug(message) {
        this.event(message, { label: '[DEBUG]', color: 'magenta', level: 'debug' });
    }

    info(message) {
        this.event(message, { label: '[INFO]', color: 'cyan', level: 'info' });
    }

    analysis(message) {
        this.event(message, { label: '[ANALYZE]', color: 'cyan', level: 'info' });
    }

    discovery(message) {
        this.event(message, { label: '[DISCOVERY]', color: 'cyan', level: 'info' });
    }

    jar(message) {
        this.event(message, { label: '[JAR]', color: 'magenta', level: 'info' });
    }

    parse(message) {
        this.event(message, { label: '[PARSE]', color: 'cyan', level: 'info' });
    }

    parseWarn(message) {
        this.event(message, { label: '[PARSE-WARN]', color: 'yellow', level: 'warn' });
    }

    parseError(message) {
        this.event(message, { label: '[PARSE-ERROR]', color: 'red', level: 'error' });
    }

    engine(message) {
        this.event(message, { label: '[ENGINE]', color: 'cyan', level: 'info' });
    }

    engineDecision(message) {
        this.event(message, { label: '[ENGINE-DECISION]', color: 'magenta', level: 'info' });
    }

    engineWarning(message) {
        this.event(message, { label: '[ENGINE-WARN]', color: 'yellow', level: 'warn' });
    }

    engineError(message) {
        this.event(message, { label: '[ENGINE-ERROR]', color: 'red', level: 'error' });
    }

    engineConflict(message) {
        this.event(message, { label: '[ENGINE-CONFLICT]', color: 'yellow', level: 'warn' });
    }

    classification(message) {
        this.event(message, { label: '[CLASSIFY]', color: 'green', level: 'info' });
    }

    graph(message) {
        this.event(message, { label: '[GRAPH]', color: 'cyan', level: 'info' });
    }

    graphWarn(message) {
        this.event(message, { label: '[GRAPH-WARN]', color: 'yellow', level: 'warn' });
    }

    graphError(message) {
        this.event(message, { label: '[GRAPH-ERROR]', color: 'red', level: 'error' });
    }

    dependency(message) {
        this.event(message, { label: '[DEPENDENCY]', color: 'cyan', level: 'info' });
    }

    dependencyPreserve(message) {
        this.event(message, { label: '[DEPENDENCY-PRESERVE]', color: 'yellow', level: 'warn' });
    }

    registry(message) {
        this.event(message, { label: '[REGISTRY]', color: 'cyan', level: 'info' });
    }

    registryWarn(message) {
        this.event(message, { label: '[REGISTRY-WARN]', color: 'yellow', level: 'warn' });
    }

    registryCache(message) {
        this.event(message, { label: '[REGISTRY-CACHE]', color: 'cyan', level: 'info' });
    }

    registryUpdate(message) {
        this.event(message, { label: '[REGISTRY-UPDATE]', color: 'magenta', level: 'info' });
    }

    registryError(message) {
        this.event(message, { label: '[REGISTRY-ERROR]', color: 'red', level: 'error' });
    }

    arbiter(message) {
        this.event(message, { label: '[ARBITER]', color: 'cyan', level: 'info' });
    }

    arbiterWarn(message) {
        this.event(message, { label: '[ARBITER-WARN]', color: 'yellow', level: 'warn' });
    }

    arbiterReview(message) {
        this.event(message, { label: '[ARBITER-REVIEW]', color: 'yellow', level: 'warn' });
    }

    arbiterError(message) {
        this.event(message, { label: '[ARBITER-ERROR]', color: 'red', level: 'error' });
    }

    deepCheck(message) {
        this.event(message, { label: '[DEEP-CHECK]', color: 'cyan', level: 'info' });
    }

    deepCheckWarn(message) {
        this.event(message, { label: '[DEEP-CHECK-WARN]', color: 'yellow', level: 'warn' });
    }

    deepCheckReview(message) {
        this.event(message, { label: '[DEEP-CHECK-REVIEW]', color: 'yellow', level: 'warn' });
    }

    deepCheckError(message) {
        this.event(message, { label: '[DEEP-CHECK-ERROR]', color: 'red', level: 'error' });
    }

    validation(message) {
        this.event(message, { label: '[VALIDATION]', color: 'cyan', level: 'info' });
    }

    validationWarn(message) {
        this.event(message, { label: '[VALIDATION-WARN]', color: 'yellow', level: 'warn' });
    }

    validationError(message) {
        this.event(message, { label: '[VALIDATION-ERROR]', color: 'red', level: 'error' });
    }

    validationSkip(message) {
        this.event(message, { label: '[VALIDATION-SKIP]', color: 'yellow', level: 'warn' });
    }

    decision(message) {
        this.event(message, { label: '[DECISION]', color: 'magenta', level: 'info' });
    }

    buildAction(message) {
        this.event(message, { label: '[BUILD]', color: 'green', level: 'info' });
    }

    dryRunAction(message) {
        this.event(message, { label: '[DRY-RUN]', color: 'yellow', level: 'info' });
    }

    report(message) {
        this.event(message, { label: '[REPORT]', color: 'cyan', level: 'info' });
    }

    hint(message) {
        this.event(message, { label: '[ПОДСКАЗКА]', color: 'yellow', level: 'info' });
    }

    warn(message) {
        this.event(message, { label: '[ВНИМАНИЕ]', color: 'yellow', level: 'warn' });
    }

    success(message, label = '[OK]') {
        this.event(message, { label, color: 'green', level: 'info' });
    }

    error(message) {
        this.event(message, { label: '[ОШИБКА]', color: 'red', level: 'error' });
    }
}

function createLogger(options) {
    return new Logger(options);
}

module.exports = {
    Logger,
    createLogger,
    normalizeLogLevel,
    LOG_LEVELS
};
