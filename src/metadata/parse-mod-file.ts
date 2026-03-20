const { createArchiveHandle } = require('../jar/archive-reader');
const { ArchiveReadError } = require('../core/errors');
const { DECLARED_SIDES, LOADER_TYPES } = require('./constants');
const { buildArchiveIndex } = require('./archive-index');
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

import type { DescriptorPatch, ModDescriptor } from '../types/descriptor';
import type { LoaderKind } from '../types/metadata';

interface ArchiveHandle {
    entries: string[];
    hasEntry(entryPath: string): boolean;
    readEntry(entryPath: string): Buffer | null;
    readText(entryPath: string): string | null;
}

interface ParsingDecision {
    descriptor?: ModDescriptor | null;
}

function applyParsePatch(descriptor: ModDescriptor, patch?: DescriptorPatch | null): ModDescriptor {
    if (!patch) {
        return descriptor;
    }

    return mergeDescriptor(descriptor, patch);
}

function parsePrimaryMetadata(archive: ArchiveHandle, loader: LoaderKind): DescriptorPatch | null {
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

function parseModFile(filePath: string): ModDescriptor {
    const descriptor = createModDescriptor(filePath);

    let archive: ArchiveHandle;

    try {
        archive = createArchiveHandle(filePath);
    } catch (error: unknown) {
        const archiveError = error as Error & { code?: string };

        if (archiveError instanceof ArchiveReadError) {
            addParsingError(
                descriptor,
                createParsingIssue({
                    code: archiveError.code || 'ARCHIVE_READ_ERROR',
                    message: archiveError.message,
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
        } catch (error: unknown) {
            const issueError = error as Error & { code?: string };

            addParsingError(
                descriptor,
                createParsingIssue({
                    code: issueError.code || 'MANIFEST_READ_ERROR',
                    message: issueError.message,
                    source: 'META-INF/MANIFEST.MF',
                    fatal: false
                })
            );
        }
    }

    if (descriptor.loader === LOADER_TYPES.unknown) {
        try {
            descriptor.archiveIndex = buildArchiveIndex(archive, descriptor);
        } catch (error: unknown) {
            const issueError = error as Error & { code?: string };

            addParsingWarning(
                descriptor,
                createParsingIssue({
                    code: issueError.code || 'ARCHIVE_INDEX_ERROR',
                    message: issueError.message,
                    source: 'archive-index',
                    fatal: false
                })
            );
        }

        addParsingWarning(descriptor, createUnknownMetadataWarning());
        descriptor.declaredSide = DECLARED_SIDES.unknown;
        return descriptor;
    }

    try {
        const parsedMetadata = parsePrimaryMetadata(archive, descriptor.loader);
        applyParsePatch(descriptor, parsedMetadata);
    } catch (error: unknown) {
        const issueError = error as Error & { code?: string };

        addParsingError(
            descriptor,
            createParsingIssue({
                code: issueError.code || 'PRIMARY_METADATA_READ_ERROR',
                message: issueError.message,
                source: descriptor.metadataFilesFound.find((item: string) => item !== 'META-INF/MANIFEST.MF') || 'metadata',
                fatal: false
            })
        );
    }

    try {
        descriptor.archiveIndex = buildArchiveIndex(archive, descriptor);
    } catch (error: unknown) {
        const issueError = error as Error & { code?: string };

        addParsingWarning(
            descriptor,
            createParsingIssue({
                code: issueError.code || 'ARCHIVE_INDEX_ERROR',
                message: issueError.message,
                source: 'archive-index',
                fatal: false
            })
        );
    }

    return descriptor;
}

function buildParsingStats(decisions: ParsingDecision[]) {
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
