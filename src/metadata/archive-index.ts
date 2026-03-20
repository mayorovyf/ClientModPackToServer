const { summarizeBytecodeReachability } = require('./bytecode-reachability');
const { summarizeClientSignatures } = require('./client-signature-index');

import type { ArchiveHintCategory, ArchiveIndex, ModDescriptor } from '../types/descriptor';

interface ArchiveHandle {
    entries: string[];
    readEntry(entryPath: string): Buffer | null;
}

const CLIENT_REFERENCE_PATTERNS = [
    Buffer.from('net/minecraft/client'),
    Buffer.from('net/minecraftforge/client'),
    Buffer.from('net/neoforged/neoforge/client'),
    Buffer.from('com/mojang/blaze3d')
];

const CATEGORY_RULES: Array<{ category: ArchiveHintCategory; patterns: RegExp[] }> = [
    {
        category: 'ui',
        patterns: [
            /screen/i,
            /gui/i,
            /menu/i,
            /tooltip/i,
            /overlay/i,
            /widget/i,
            /advancement/i,
            /toast/i,
            /inventory/i
        ]
    },
    {
        category: 'visual',
        patterns: [
            /render/i,
            /shader/i,
            /model/i,
            /texture/i,
            /particle/i,
            /visual/i,
            /entity[_-]?model/i,
            /entity[_-]?texture/i
        ]
    },
    {
        category: 'qol',
        patterns: [
            /crosshair/i,
            /minimap/i,
            /worldmap/i,
            /waypoint/i,
            /chat/i,
            /f3/i,
            /keybind/i,
            /keymap/i
        ]
    },
    {
        category: 'optimization',
        patterns: [
            /optimi[sz]/i,
            /modernfix/i,
            /smooth/i,
            /memory/i,
            /performance/i,
            /fps/i,
            /cache/i
        ]
    },
    {
        category: 'library',
        patterns: [
            /(^|[-_/])(lib|library|api|core|common)([-_/]|$)/i,
            /framework/i,
            /platform/i
        ]
    },
    {
        category: 'compat',
        patterns: [
            /compat/i,
            /integration/i,
            /bridge/i,
            /connector/i
        ]
    }
];

function collectHintCategories(entries: string[]): Pick<ArchiveIndex, 'hintCategories' | 'sampleEntries'> {
    const categories = new Set<ArchiveHintCategory>();
    const sampleEntries: string[] = [];

    for (const entry of entries) {
        const normalizedEntry = String(entry || '').trim();

        if (!normalizedEntry) {
            continue;
        }

        for (const rule of CATEGORY_RULES) {
            if (!rule.patterns.some((pattern) => pattern.test(normalizedEntry))) {
                continue;
            }

            categories.add(rule.category);

            if (sampleEntries.length < 12 && !sampleEntries.includes(normalizedEntry)) {
                sampleEntries.push(normalizedEntry);
            }
        }
    }

    return {
        hintCategories: [...categories].sort(),
        sampleEntries
    };
}

function countClientReferences(archive: ArchiveHandle, classEntries: string[]): { clientReferenceCount: number; sampleEntries: string[] } {
    let clientReferenceCount = 0;
    const sampleEntries: string[] = [];

    for (const entry of classEntries.slice(0, 96)) {
        const buffer = archive.readEntry(entry);

        if (!buffer) {
            continue;
        }

        if (!CLIENT_REFERENCE_PATTERNS.some((pattern) => buffer.includes(pattern))) {
            continue;
        }

        clientReferenceCount += 1;

        if (sampleEntries.length < 12) {
            sampleEntries.push(entry);
        }

        if (clientReferenceCount >= 24) {
            break;
        }
    }

    return {
        clientReferenceCount,
        sampleEntries
    };
}

function buildArchiveIndex(archive: ArchiveHandle, descriptor: ModDescriptor | null = null): ArchiveIndex {
    const entries = archive.entries || [];
    const classEntries = entries.filter((entry) => entry.endsWith('.class'));
    const assetEntries = entries.filter((entry) => entry.startsWith('assets/'));
    const mixinConfigs = entries.filter((entry) => entry.toLowerCase().includes('mixin') && entry.endsWith('.json'));
    const categoryState = collectHintCategories(entries);
    const clientState = countClientReferences(archive, classEntries);
    const bytecode = summarizeBytecodeReachability({
        archive,
        descriptor
    });
    const clientSignatures = summarizeClientSignatures({
        archive,
        descriptor
    });

    return {
        entryCount: entries.length,
        classEntryCount: classEntries.length,
        assetEntryCount: assetEntries.length,
        mixinConfigCount: mixinConfigs.length,
        clientReferenceCount: clientState.clientReferenceCount,
        hasClientCodeReferences: clientState.clientReferenceCount > 0,
        hintCategories: categoryState.hintCategories,
        sampleEntries: [...new Set([...categoryState.sampleEntries, ...clientState.sampleEntries])].slice(0, 12),
        bytecode,
        clientSignatures
    };
}

module.exports = {
    buildArchiveIndex
};
