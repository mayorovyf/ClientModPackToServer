const { createArchiveHandle } = require('../jar/archive-reader');
const { ArchiveReadError } = require('../core/errors');
const { DECLARED_SIDES, LOADER_TYPES } = require('./constants');
const {
    addParsingError,
    addParsingWarning,
    createModDescriptor,
    createParsingIssue,
    mergeDescriptor
} = require('./descriptor');
const { detectLoader } = require('./loader-detection');
const { parseFabricMetadata } = require('./parsers/fabric');
const { parseModsToml } = require('./parsers/forge');
const { parseManifest } = require('./parsers/manifest');
const { parseNeoForgeMetadata } = require('./parsers/neoforge');
const { parseQuiltMetadata } = require('./parsers/quilt');

function applyParsePatch(descriptor, patch) {
    if (!patch) {
        return descriptor;
    }

    return mergeDescriptor(descriptor, patch);
}

function parsePrimaryMetadata(archive, loader) {
    switch (loader) {
        case LOADER_TYPES.fabric:
            return parseFabricMetadata(archive.readText('fabric.mod.json'));
        case LOADER_TYPES.quilt:
            return parseQuiltMetadata(archive.readText('quilt.mod.json'));
        case LOADER_TYPES.forge:
            return parseModsToml(archive.readText('META-INF/mods.toml'));
        case LOADER_TYPES.neoforge:
            return parseNeoForgeMetadata(archive.readText('META-INF/neoforge.mods.toml'));
        default:
            return null;
    }
}

function createUnknownMetadataWarning() {
    return createParsingIssue({
        code: 'METADATA_NOT_FOUND',
        message: 'Поддерживаемые metadata-файлы не найдены',
        source: 'jar-scan',
        fatal: false
    });
}

function parseModFile(filePath) {
    const descriptor = createModDescriptor(filePath);

    let archive;

    try {
        archive = createArchiveHandle(filePath);
    } catch (error) {
        if (error instanceof ArchiveReadError) {
            addParsingError(
                descriptor,
                createParsingIssue({
                    code: error.code,
                    message: error.message,
                    source: 'jar-read',
                    fatal: true
                })
            );

            return descriptor;
        }

        throw error;
    }

    const detection = detectLoader(archive.entries);
    descriptor.loader = detection.loader;
    descriptor.metadataFilesFound = detection.metadataFilesFound;

    if (archive.hasEntry('META-INF/MANIFEST.MF')) {
        try {
            applyParsePatch(descriptor, parseManifest(archive.readText('META-INF/MANIFEST.MF')));
        } catch (error) {
            addParsingError(
                descriptor,
                createParsingIssue({
                    code: error.code || 'MANIFEST_READ_ERROR',
                    message: error.message,
                    source: 'META-INF/MANIFEST.MF',
                    fatal: false
                })
            );
        }
    }

    if (descriptor.loader === LOADER_TYPES.unknown) {
        addParsingWarning(descriptor, createUnknownMetadataWarning());
        descriptor.declaredSide = DECLARED_SIDES.unknown;
        return descriptor;
    }

    try {
        const parsedMetadata = parsePrimaryMetadata(archive, descriptor.loader);
        applyParsePatch(descriptor, parsedMetadata);
    } catch (error) {
        addParsingError(
            descriptor,
            createParsingIssue({
                code: error.code || 'PRIMARY_METADATA_READ_ERROR',
                message: error.message,
                source: descriptor.metadataFilesFound.find((item) => item !== 'META-INF/MANIFEST.MF') || 'metadata',
                fatal: false
            })
        );
    }

    return descriptor;
}

function buildParsingStats(decisions) {
    const summary = {
        total: decisions.length,
        loaders: {
            fabric: 0,
            quilt: 0,
            forge: 0,
            neoforge: 0,
            unknown: 0
        },
        filesWithWarnings: 0,
        filesWithErrors: 0,
        warningCount: 0,
        errorCount: 0
    };

    for (const decision of decisions) {
        const descriptor = decision.descriptor;

        if (!descriptor) {
            summary.loaders.unknown += 1;
            continue;
        }

        if (!Object.prototype.hasOwnProperty.call(summary.loaders, descriptor.loader)) {
            summary.loaders.unknown += 1;
        } else {
            summary.loaders[descriptor.loader] += 1;
        }

        if (descriptor.parsingWarnings.length > 0) {
            summary.filesWithWarnings += 1;
            summary.warningCount += descriptor.parsingWarnings.length;
        }

        if (descriptor.parsingErrors.length > 0) {
            summary.filesWithErrors += 1;
            summary.errorCount += descriptor.parsingErrors.length;
        }
    }

    return summary;
}

module.exports = {
    buildParsingStats,
    parseModFile
};
