const fs = require('node:fs');

const { FileReadError } = require('../core/errors');

interface BlockListLogger {
    info(message: string): void;
    paint(text: string, color: string): string;
}

function parseBlockListContent(content: string): string[] {
    return content
        .split(/\r?\n/)
        .map((line) => line.trim().toLowerCase())
        .filter((line) => line.length > 0 && !line.startsWith('#'));
}

function loadBlockList(blockListPath: string, logger?: BlockListLogger | null): string[] {
    try {
        const content = fs.readFileSync(blockListPath, 'utf8');
        const mods = parseBlockListContent(content);

        if (logger) {
            logger.info(`Loaded ${logger.paint(String(mods.length), 'green')} client mods from block.txt`);
        }

        return mods;
    } catch (error) {
        throw new FileReadError(`Failed to read block.txt: ${blockListPath}`, { cause: error });
    }
}

module.exports = {
    loadBlockList,
    parseBlockListContent
};
