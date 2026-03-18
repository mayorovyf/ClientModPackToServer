const { createParsingIssue } = require('../descriptor');

function unfoldManifestLines(content) {
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const unfolded = [];

    for (const line of lines) {
        if (line.startsWith(' ') && unfolded.length > 0) {
            unfolded[unfolded.length - 1] += line.slice(1);
            continue;
        }

        unfolded.push(line);
    }

    return unfolded;
}

function parseManifest(content) {
    const manifestHints = {};

    for (const line of unfoldManifestLines(content)) {
        const separatorIndex = line.indexOf(':');

        if (separatorIndex === -1) {
            continue;
        }

        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();

        if (key) {
            manifestHints[key] = value;
        }
    }

    return {
        metadataFilesFound: ['META-INF/MANIFEST.MF'],
        displayName: manifestHints['Implementation-Title'] || manifestHints['Specification-Title'] || null,
        version: manifestHints['Implementation-Version'] || manifestHints['Specification-Version'] || null,
        manifestHints,
        parsingWarnings: Object.keys(manifestHints).length === 0
            ? [
                  createParsingIssue({
                      code: 'MANIFEST_EMPTY',
                      message: 'MANIFEST.MF найден, но полезные поля не извлечены',
                      source: 'META-INF/MANIFEST.MF',
                      fatal: false
                  })
              ]
            : []
    };
}

module.exports = {
    parseManifest
};
