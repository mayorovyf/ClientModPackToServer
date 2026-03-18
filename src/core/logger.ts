const { colorize } = require('./colors');

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LoggerColor = 'green' | 'yellow' | 'red' | 'cyan' | 'magenta';

interface LoggerOptions {
    useColors?: boolean;
    level?: LogLevel | string;
    context?: string;
}

interface EventOptions {
    label?: string;
    color?: LoggerColor;
    level?: LogLevel;
}

const LOG_LEVELS: Readonly<Record<LogLevel, number>> = Object.freeze({
    debug: 10,
    info: 20,
    warn: 30,
    error: 40
});

function normalizeLogLevel(level: string | null | undefined): LogLevel {
    if (!level) {
        return 'info';
    }

    return Object.prototype.hasOwnProperty.call(LOG_LEVELS, level) ? (level as LogLevel) : 'info';
}

class Logger {
    useColors: boolean;
    level: LogLevel;
    context: string;

    constructor({ useColors = true, level = 'info', context = '' }: LoggerOptions = {}) {
        this.useColors = useColors;
        this.level = normalizeLogLevel(level);
        this.context = context;
    }

    canLog(level: string): boolean {
        return LOG_LEVELS[normalizeLogLevel(level)] >= LOG_LEVELS[this.level];
    }

    paint(text: string, color?: LoggerColor): string {
        return colorize(text, color, { useColors: this.useColors });
    }

    formatMessage(message = ''): string {
        if (!message) {
            return '';
        }

        return this.context ? `${this.context} ${message}` : message;
    }

    raw(message = ''): void {
        console.log(this.formatMessage(message));
    }

    event(message: string, { label = '[INFO]', color = 'cyan', level = 'info' }: EventOptions = {}): void {
        if (!this.canLog(level)) {
            return;
        }

        console.log(`${this.paint(label, color)} ${this.formatMessage(message)}`);
    }

    withContext(context: string): Logger {
        const nextContext = this.context ? `${this.context} ${context}` : context;

        return new Logger({
            useColors: this.useColors,
            level: this.level,
            context: nextContext
        });
    }

    debug(message: string): void {
        this.event(message, { label: '[DEBUG]', color: 'magenta', level: 'debug' });
    }

    info(message: string): void {
        this.event(message, { label: '[INFO]', color: 'cyan', level: 'info' });
    }

    analysis(message: string): void {
        this.event(message, { label: '[ANALYZE]', color: 'cyan', level: 'info' });
    }

    discovery(message: string): void {
        this.event(message, { label: '[DISCOVERY]', color: 'cyan', level: 'info' });
    }

    jar(message: string): void {
        this.event(message, { label: '[JAR]', color: 'magenta', level: 'info' });
    }

    parse(message: string): void {
        this.event(message, { label: '[PARSE]', color: 'cyan', level: 'info' });
    }

    parseWarn(message: string): void {
        this.event(message, { label: '[PARSE-WARN]', color: 'yellow', level: 'warn' });
    }

    parseError(message: string): void {
        this.event(message, { label: '[PARSE-ERROR]', color: 'red', level: 'error' });
    }

    engine(message: string): void {
        this.event(message, { label: '[ENGINE]', color: 'cyan', level: 'info' });
    }

    engineDecision(message: string): void {
        this.event(message, { label: '[ENGINE-DECISION]', color: 'magenta', level: 'info' });
    }

    engineWarning(message: string): void {
        this.event(message, { label: '[ENGINE-WARN]', color: 'yellow', level: 'warn' });
    }

    engineError(message: string): void {
        this.event(message, { label: '[ENGINE-ERROR]', color: 'red', level: 'error' });
    }

    engineConflict(message: string): void {
        this.event(message, { label: '[ENGINE-CONFLICT]', color: 'yellow', level: 'warn' });
    }

    classification(message: string): void {
        this.event(message, { label: '[CLASSIFY]', color: 'green', level: 'info' });
    }

    graph(message: string): void {
        this.event(message, { label: '[GRAPH]', color: 'cyan', level: 'info' });
    }

    graphWarn(message: string): void {
        this.event(message, { label: '[GRAPH-WARN]', color: 'yellow', level: 'warn' });
    }

    graphError(message: string): void {
        this.event(message, { label: '[GRAPH-ERROR]', color: 'red', level: 'error' });
    }

    dependency(message: string): void {
        this.event(message, { label: '[DEPENDENCY]', color: 'cyan', level: 'info' });
    }

    dependencyPreserve(message: string): void {
        this.event(message, { label: '[DEPENDENCY-PRESERVE]', color: 'yellow', level: 'warn' });
    }

    registry(message: string): void {
        this.event(message, { label: '[REGISTRY]', color: 'cyan', level: 'info' });
    }

    registryWarn(message: string): void {
        this.event(message, { label: '[REGISTRY-WARN]', color: 'yellow', level: 'warn' });
    }

    registryCache(message: string): void {
        this.event(message, { label: '[REGISTRY-CACHE]', color: 'cyan', level: 'info' });
    }

    registryUpdate(message: string): void {
        this.event(message, { label: '[REGISTRY-UPDATE]', color: 'magenta', level: 'info' });
    }

    registryError(message: string): void {
        this.event(message, { label: '[REGISTRY-ERROR]', color: 'red', level: 'error' });
    }

    arbiter(message: string): void {
        this.event(message, { label: '[ARBITER]', color: 'cyan', level: 'info' });
    }

    arbiterWarn(message: string): void {
        this.event(message, { label: '[ARBITER-WARN]', color: 'yellow', level: 'warn' });
    }

    arbiterReview(message: string): void {
        this.event(message, { label: '[ARBITER-REVIEW]', color: 'yellow', level: 'warn' });
    }

    arbiterError(message: string): void {
        this.event(message, { label: '[ARBITER-ERROR]', color: 'red', level: 'error' });
    }

    deepCheck(message: string): void {
        this.event(message, { label: '[DEEP-CHECK]', color: 'cyan', level: 'info' });
    }

    deepCheckWarn(message: string): void {
        this.event(message, { label: '[DEEP-CHECK-WARN]', color: 'yellow', level: 'warn' });
    }

    deepCheckReview(message: string): void {
        this.event(message, { label: '[DEEP-CHECK-REVIEW]', color: 'yellow', level: 'warn' });
    }

    deepCheckError(message: string): void {
        this.event(message, { label: '[DEEP-CHECK-ERROR]', color: 'red', level: 'error' });
    }

    validation(message: string): void {
        this.event(message, { label: '[VALIDATION]', color: 'cyan', level: 'info' });
    }

    validationWarn(message: string): void {
        this.event(message, { label: '[VALIDATION-WARN]', color: 'yellow', level: 'warn' });
    }

    validationError(message: string): void {
        this.event(message, { label: '[VALIDATION-ERROR]', color: 'red', level: 'error' });
    }

    validationSkip(message: string): void {
        this.event(message, { label: '[VALIDATION-SKIP]', color: 'yellow', level: 'warn' });
    }

    decision(message: string): void {
        this.event(message, { label: '[DECISION]', color: 'magenta', level: 'info' });
    }

    buildAction(message: string): void {
        this.event(message, { label: '[BUILD]', color: 'green', level: 'info' });
    }

    dryRunAction(message: string): void {
        this.event(message, { label: '[DRY-RUN]', color: 'yellow', level: 'info' });
    }

    report(message: string): void {
        this.event(message, { label: '[REPORT]', color: 'cyan', level: 'info' });
    }

    hint(message: string): void {
        this.event(message, { label: '[ПОДСКАЗКА]', color: 'yellow', level: 'info' });
    }

    warn(message: string): void {
        this.event(message, { label: '[ВНИМАНИЕ]', color: 'yellow', level: 'warn' });
    }

    success(message: string, label = '[OK]'): void {
        this.event(message, { label, color: 'green', level: 'info' });
    }

    error(message: string): void {
        this.event(message, { label: '[ОШИБКА]', color: 'red', level: 'error' });
    }
}

function createLogger(options?: LoggerOptions): Logger {
    return new Logger(options);
}

module.exports = {
    Logger,
    createLogger,
    normalizeLogLevel,
    LOG_LEVELS
};
