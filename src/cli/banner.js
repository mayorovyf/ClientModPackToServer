function printBanner(logger) {
    const line = '='.repeat(52);

    logger.raw('');
    logger.raw(logger.paint(line, 'magenta'));
    logger.raw(logger.paint('CLIENT TO SERVER', 'magenta'));
    logger.raw(logger.paint('Автор: F_aN | Алексей', 'magenta'));
    logger.raw(logger.paint('Telegram: t.me/F_aN_N', 'magenta'));
    logger.raw(logger.paint(line, 'magenta'));
    logger.raw('');
}

module.exports = {
    printBanner
};
