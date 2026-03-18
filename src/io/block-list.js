const fs = require('fs');

const { FileReadError } = require('../core/errors');

function parseBlockListContent(content) {
    return content
        .split(/\r?\n/)
        .map((line) => line.trim().toLowerCase())
        .filter((line) => line.length > 0 && !line.startsWith('#'));
}

function loadBlockList(blockListPath, logger) {
    try {
        const content = fs.readFileSync(blockListPath, 'utf8');
        const mods = parseBlockListContent(content);

        if (logger) {
            logger.info(`Загружено ${logger.paint(String(mods.length), 'green')} клиентских модов из block.txt`);
        }

        return mods;
    } catch (error) {
        throw new FileReadError(`Не удалось прочитать block.txt: ${blockListPath}`, { cause: error });
    }
}

module.exports = {
    loadBlockList,
    parseBlockListContent
};
