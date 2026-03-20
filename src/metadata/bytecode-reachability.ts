const path = require('node:path');

const { readConstantPool } = require('./bytecode-constant-pool');

import type { BytecodeReachabilityIndex, ModDescriptor } from '../types/descriptor';

interface ArchiveHandle {
    entries: string[];
    readEntry(entryPath: string): Buffer | null;
}

const CLIENT_REFERENCE_PATTERNS = [
    'net/minecraft/client/',
    'net/minecraftforge/client/',
    'net/neoforged/neoforge/client/',
    'com/mojang/blaze3d/'
];
const COMMON_REFERENCE_PATTERNS = [
    'net/minecraft/world/',
    'net/minecraft/core/',
    'net/minecraft/resources/',
    'net/minecraft/network/',
    'net/minecraftforge/common/',
    'net/neoforged/neoforge/common/',
    'net/minecraftforge/event/',
    'net/neoforged/bus/api/'
];
const SERVER_REFERENCE_PATTERNS = [
    'net/minecraft/server/',
    'net/minecraft/server/dedicated/',
    'net/minecraftforge/server/',
    'net/neoforged/neoforge/server/'
];
const MAX_ANALYZED_CLASSES = 192;

function normalizeClassEntryFromValue(value: unknown): string | null {
    const normalized = String(value || '').trim();

    if (!normalized) {
        return null;
    }

    const withSlashes = normalized.replace(/\./g, '/').replace(/^\/+/, '');
    return withSlashes.endsWith('.class') ? withSlashes : `${withSlashes}.class`;
}

function normalizeToken(value: unknown): string {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function collectModTokens(descriptor: ModDescriptor | null | undefined): string[] {
    if (!descriptor) {
        return [];
    }

    const values = [
        descriptor.fileName.replace(/\.jar$/i, ''),
        descriptor.displayName,
        ...descriptor.modIds,
        ...descriptor.provides
    ];

    return [...new Set(values.map((value) => normalizeToken(value)).filter((token) => token.length >= 4))];
}

function buildExplicitRootEntries(descriptor: ModDescriptor | null | undefined): Set<string> {
    const explicitRoots = new Set<string>();

    if (!descriptor) {
        return explicitRoots;
    }

    for (const entrypoint of descriptor.entrypoints || []) {
        const classEntry = normalizeClassEntryFromValue(entrypoint.value);

        if (classEntry) {
            explicitRoots.add(classEntry);
        }
    }

    for (const mixinConfig of descriptor.mixinConfigs || []) {
        const inferred = normalizeClassEntryFromValue(String(mixinConfig || '').replace(/\.mixins?\.json$/i, ''));

        if (inferred) {
            explicitRoots.add(inferred);
        }
    }

    return explicitRoots;
}

function isExcludedRootPath(entry: string): boolean {
    const normalized = entry.toLowerCase();

    return [
        '/mixin/',
        '/compat/',
        '/integration/',
        '/bridge/',
        '/connector/',
        '/api/',
        '/config/',
        '/util/',
        '/impl/',
        '/generated/',
        '/mixinextras/'
    ].some((token) => normalized.includes(token));
}

function scoreRootClass(entry: string, explicitRoots: Set<string>, modTokens: string[]): number {
    const normalized = entry.toLowerCase();
    const simpleName = path.basename(normalized, '.class');
    const compactEntry = normalizeToken(normalized);
    let score = 0;

    if (explicitRoots.has(entry)) {
        score += 100;
    }

    if (/(mod|main|bootstrap|initializer|init|forge|neoforge|common|client|server)/i.test(simpleName)) {
        score += 30;
    }

    if (!isExcludedRootPath(entry)) {
        score += 10;
    }

    if (entry.split('/').length <= 4) {
        score += 5;
    }

    for (const token of modTokens) {
        if (compactEntry.includes(token)) {
            score += 12;
        }
    }

    return score;
}

function selectRootClasses(classEntries: string[], descriptor: ModDescriptor | null | undefined): string[] {
    const explicitRoots = buildExplicitRootEntries(descriptor);
    const modTokens = collectModTokens(descriptor);
    const scored = classEntries
        .map((entry) => ({
            entry,
            score: scoreRootClass(entry, explicitRoots, modTokens)
        }))
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score || left.entry.localeCompare(right.entry));

    const roots = scored.slice(0, 24).map((item) => item.entry);

    if (roots.length > 0) {
        return roots;
    }

    return classEntries
        .filter((entry) => !isExcludedRootPath(entry))
        .slice(0, 12);
}

function collectFamilyHits(values: string[]): {
    clientHits: string[];
    commonHits: string[];
    serverHits: string[];
} {
    const hits = {
        clientHits: [] as string[],
        commonHits: [] as string[],
        serverHits: [] as string[]
    };

    for (const value of values) {
        const normalized = String(value || '').toLowerCase();

        if (!normalized) {
            continue;
        }

        if (CLIENT_REFERENCE_PATTERNS.some((pattern) => normalized.includes(pattern))) {
            hits.clientHits.push(value);
        }

        if (COMMON_REFERENCE_PATTERNS.some((pattern) => normalized.includes(pattern))) {
            hits.commonHits.push(value);
        }

        if (SERVER_REFERENCE_PATTERNS.some((pattern) => normalized.includes(pattern))) {
            hits.serverHits.push(value);
        }
    }

    return {
        clientHits: [...new Set(hits.clientHits)].slice(0, 6),
        commonHits: [...new Set(hits.commonHits)].slice(0, 6),
        serverHits: [...new Set(hits.serverHits)].slice(0, 6)
    };
}

function collectFallbackHits(buffer: Buffer): ReturnType<typeof collectFamilyHits> {
    const rawText = buffer.toString('latin1');
    const values: string[] = [];

    for (const pattern of [...CLIENT_REFERENCE_PATTERNS, ...COMMON_REFERENCE_PATTERNS, ...SERVER_REFERENCE_PATTERNS]) {
        if (rawText.includes(pattern)) {
            values.push(pattern);
        }
    }

    return collectFamilyHits(values);
}

function analyzeClassBuffer(buffer: Buffer): ReturnType<typeof collectFamilyHits> {
    const summary = readConstantPool(buffer);
    const hits = collectFamilyHits([...summary.classNames, ...summary.utf8Values]);

    if (hits.clientHits.length > 0 || hits.commonHits.length > 0 || hits.serverHits.length > 0) {
        return hits;
    }

    return collectFallbackHits(buffer);
}

function pushSample(target: string[], value: string): void {
    if (!value || target.includes(value) || target.length >= 12) {
        return;
    }

    target.push(value);
}

function summarizeBytecodeReachability({
    archive,
    descriptor
}: {
    archive: ArchiveHandle;
    descriptor?: ModDescriptor | null;
}): BytecodeReachabilityIndex | null {
    const classEntries = (archive.entries || []).filter((entry) => entry.endsWith('.class'));

    if (classEntries.length === 0) {
        return null;
    }

    const rootClasses = selectRootClasses(classEntries, descriptor);
    const prioritizedEntries = [
        ...rootClasses,
        ...classEntries.filter((entry) => !rootClasses.includes(entry))
    ].slice(0, MAX_ANALYZED_CLASSES);
    const rootSet = new Set(rootClasses);
    const summary: BytecodeReachabilityIndex = {
        analyzedClassCount: 0,
        truncated: classEntries.length > MAX_ANALYZED_CLASSES,
        rootClasses,
        rootClientReferenceCount: 0,
        rootCommonReferenceCount: 0,
        rootServerReferenceCount: 0,
        deepClientReferenceCount: 0,
        deepCommonReferenceCount: 0,
        deepServerReferenceCount: 0,
        rootClientReferenceSamples: [],
        rootCommonReferenceSamples: [],
        rootServerReferenceSamples: [],
        deepClientReferenceSamples: []
    };

    for (const entry of prioritizedEntries) {
        const buffer = archive.readEntry(entry);

        if (!buffer) {
            continue;
        }

        summary.analyzedClassCount += 1;
        const hits = analyzeClassBuffer(buffer);
        const isRootClass = rootSet.has(entry);

        if (hits.clientHits.length > 0) {
            if (isRootClass) {
                summary.rootClientReferenceCount += 1;
                pushSample(summary.rootClientReferenceSamples, `${entry} -> ${hits.clientHits[0]}`);
            } else {
                summary.deepClientReferenceCount += 1;
                pushSample(summary.deepClientReferenceSamples, `${entry} -> ${hits.clientHits[0]}`);
            }
        }

        if (hits.commonHits.length > 0) {
            if (isRootClass) {
                summary.rootCommonReferenceCount += 1;
                pushSample(summary.rootCommonReferenceSamples, `${entry} -> ${hits.commonHits[0]}`);
            } else {
                summary.deepCommonReferenceCount += 1;
            }
        }

        if (hits.serverHits.length > 0) {
            if (isRootClass) {
                summary.rootServerReferenceCount += 1;
                pushSample(summary.rootServerReferenceSamples, `${entry} -> ${hits.serverHits[0]}`);
            } else {
                summary.deepServerReferenceCount += 1;
            }
        }
    }

    return summary;
}

module.exports = {
    selectRootClasses,
    summarizeBytecodeReachability
};
