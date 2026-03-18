const ANSI_COLORS = Object.freeze({
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
});

function colorize(text, color, { useColors = true } = {}) {
    if (!useColors || !ANSI_COLORS[color]) {
        return text;
    }

    return `${ANSI_COLORS[color]}${text}${ANSI_COLORS.reset}`;
}

module.exports = {
    ANSI_COLORS,
    colorize
};
