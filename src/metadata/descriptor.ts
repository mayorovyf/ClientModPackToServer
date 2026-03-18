const fs = require('fs');
const path = require('path');

const { DECLARED_SIDES, LOADER_TYPES } = require('./constants');

import type {
    DependencyDescriptor,
    MetadataIssue,
    SideHint
} from '../types/metadata';
import type { DescriptorPatch, DescriptorSummary, ModDescriptor } from '../types/descriptor';

function dedupeStrings(values: unknown[] = []): string[] {
    return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function normalizeDeclaredSide(side: unknown): SideHint {
    if (!side) {
        return DECLARED_SIDES.unknown;
    }

    const value = String(side).trim().toLowerCase();

    if (['client', 'clientside', 'client_only', 'client-only'].includes(value)) {
        return DECLARED_SIDES.client;
    }

    if (['server', 'serverside', 'server_only', 'server-only', 'dedicated_server'].includes(value)) {
        return DECLARED_SIDES.server;
    }

    if (['both', 'common', '*', 'universal'].includes(value)) {
        return DECLARED_SIDES.both;
    }

    return DECLARED_SIDES.unknown;
}

function createDependencyRecord({
    modId,
    kind = 'depends',
    required = true,
    versionRange = null,
    loaderOrigin = LOADER_TYPES.unknown,
    sideHint = DECLARED_SIDES.unknown
}: {
    modId?: unknown;
    kind?: string;
    required?: boolean;
    versionRange?: unknown;
    loaderOrigin?: DependencyDescriptor['loaderOrigin'];
    sideHint?: unknown;
}): DependencyDescriptor {
    return {
        modId: modId ? String(modId).trim() : null,
        kind,
        required: Boolean(required),
        versionRange: versionRange ? String(versionRange).trim() : null,
        loaderOrigin,
        sideHint: normalizeDeclaredSide(sideHint)
    };
}

function createModDescriptor(filePath: string): ModDescriptor {
    const stats = fs.existsSync(filePath) ? fs.statSync(filePath) : null;

    return {
        fileName: path.basename(filePath),
        filePath,
        fileSize: stats ? stats.size : null,
        loader: LOADER_TYPES.unknown,
        modIds: [],
        displayName: null,
        version: null,
        metadataFilesFound: [],
        declaredSide: DECLARED_SIDES.unknown,
        entrypoints: [],
        mixinConfigs: [],
        dependencies: [],
        optionalDependencies: [],
        incompatibilities: [],
        provides: [],
        manifestHints: {},
        parsingWarnings: [],
        parsingErrors: []
    };
}

function addParsingWarning(descriptor: ModDescriptor, warning: MetadataIssue): ModDescriptor {
    descriptor.parsingWarnings.push(warning);
    return descriptor;
}

function addParsingError(descriptor: ModDescriptor, error: MetadataIssue): ModDescriptor {
    descriptor.parsingErrors.push(error);
    return descriptor;
}

function mergeDescriptor(descriptor: ModDescriptor, patch: DescriptorPatch = {}): ModDescriptor {
    if (patch.loader && descriptor.loader === LOADER_TYPES.unknown) {
        descriptor.loader = patch.loader;
    }

    descriptor.modIds = dedupeStrings([...descriptor.modIds, ...(patch.modIds || [])]);
    descriptor.metadataFilesFound = dedupeStrings([...descriptor.metadataFilesFound, ...(patch.metadataFilesFound || [])]);
    descriptor.mixinConfigs = dedupeStrings([...descriptor.mixinConfigs, ...(patch.mixinConfigs || [])]);
    descriptor.provides = dedupeStrings([...descriptor.provides, ...(patch.provides || [])]);
    descriptor.entrypoints = [...descriptor.entrypoints, ...(patch.entrypoints || [])];
    descriptor.dependencies = [...descriptor.dependencies, ...(patch.dependencies || [])];
    descriptor.optionalDependencies = [...descriptor.optionalDependencies, ...(patch.optionalDependencies || [])];
    descriptor.incompatibilities = [...descriptor.incompatibilities, ...(patch.incompatibilities || [])];
    descriptor.parsingWarnings = [...descriptor.parsingWarnings, ...(patch.parsingWarnings || [])];
    descriptor.parsingErrors = [...descriptor.parsingErrors, ...(patch.parsingErrors || [])];
    descriptor.manifestHints = {
        ...descriptor.manifestHints,
        ...(patch.manifestHints || {})
    };

    if (!descriptor.displayName && patch.displayName) {
        descriptor.displayName = patch.displayName;
    }

    if (!descriptor.version && patch.version) {
        descriptor.version = patch.version;
    }

    if (patch.declaredSide) {
        const normalizedSide = normalizeDeclaredSide(patch.declaredSide);

        if (descriptor.declaredSide === DECLARED_SIDES.unknown || normalizedSide !== DECLARED_SIDES.unknown) {
            descriptor.declaredSide = normalizedSide;
        }
    }

    return descriptor;
}

function createParsingIssue({
    code,
    message,
    source,
    fatal = false
}: {
    code: string;
    message: string;
    source: string;
    fatal?: boolean;
}): MetadataIssue {
    return {
        code,
        message,
        source,
        fatal
    };
}

function summarizeDescriptor(descriptor: ModDescriptor): DescriptorSummary {
    return {
        fileName: descriptor.fileName,
        loader: descriptor.loader,
        modIds: descriptor.modIds,
        displayName: descriptor.displayName,
        version: descriptor.version,
        declaredSide: descriptor.declaredSide,
        metadataFilesFound: descriptor.metadataFilesFound,
        dependencies: descriptor.dependencies.length,
        optionalDependencies: descriptor.optionalDependencies.length,
        incompatibilities: descriptor.incompatibilities.length,
        parsingWarnings: descriptor.parsingWarnings.length,
        parsingErrors: descriptor.parsingErrors.length
    };
}

module.exports = {
    addParsingError,
    addParsingWarning,
    createDependencyRecord,
    createModDescriptor,
    createParsingIssue,
    dedupeStrings,
    mergeDescriptor,
    normalizeDeclaredSide,
    summarizeDescriptor
};
