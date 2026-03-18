function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isClientMod(fileName, blockList) {
    const lowerFileName = fileName.toLowerCase();

    for (const modName of blockList) {
        if (lowerFileName.startsWith(modName + '-')) {
            return modName;
        }

        if (lowerFileName.startsWith(modName + '_')) {
            return modName;
        }

        if (lowerFileName.startsWith(modName + '.')) {
            return modName;
        }

        if (lowerFileName === modName + '.jar') {
            return modName;
        }

        const patterns = [
            new RegExp(`^${escapeRegex(modName)}[-_.]`, 'i'),
            new RegExp(`[-_\\[]${escapeRegex(modName)}[-_.]`, 'i'),
            new RegExp(`^\\[.*\\]${escapeRegex(modName)}[-_.]`, 'i')
        ];

        for (const pattern of patterns) {
            if (pattern.test(lowerFileName)) {
                return modName;
            }
        }
    }

    return null;
}

module.exports = {
    escapeRegex,
    isClientMod
};
