const ANSI_COLORS = Object.freeze({
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
});

function colorize(text: string, color: string, { useColors = true }: { useColors?: boolean } = {}): string {
    if (!useColors || !Object.prototype.hasOwnProperty.call(ANSI_COLORS, color)) {
        return text;
    }

    return `${ANSI_COLORS[color as keyof typeof ANSI_COLORS]}${text}${ANSI_COLORS.reset}`;
}

module.exports = {
    ANSI_COLORS,
    colorize
};
