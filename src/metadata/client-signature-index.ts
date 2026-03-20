const { parseClassSignatures } = require('./class-signatures');
const { selectRootClasses } = require('./bytecode-reachability');

import type { ClientSignatureIndex, ModDescriptor } from '../types/descriptor';

interface ArchiveHandle {
    entries: string[];
    readEntry(entryPath: string): Buffer | null;
    readText?(entryPath: string): string | null;
}

const GUI_SIGNATURE_PATTERNS = [
    'net/minecraft/client/gui/screens/',
    'net/minecraft/client/gui/components/',
    'net/minecraft/client/gui/guigraphics',
    'net/minecraft/client/gui/font',
    'net/minecraft/client/gui/navigation'
];
const RENDER_SIGNATURE_PATTERNS = [
    'net/minecraft/client/renderer/',
    'net/minecraft/client/model/',
    'net/minecraft/client/resources/model/',
    'net/minecraft/client/particle/',
    'com/mojang/blaze3d/'
];
const AUDIO_SIGNATURE_PATTERNS = [
    'net/minecraft/client/resources/sounds/',
    'net/minecraft/client/sounds/',
    'soundinstance',
    'soundengine'
];
const INPUT_SIGNATURE_PATTERNS = [
    'net/minecraft/client/keymapping',
    'net/minecraftforge/client/event/inputevent',
    'net/neoforged/neoforge/client/event/inputevent',
    'keymapping'
];
const FORGE_CLIENT_EVENT_PATTERNS = [
    'net/minecraftforge/client/event/',
    'net/neoforged/neoforge/client/event/'
];
const SERVICE_CLIENT_PATTERNS = [
    /iclientplatform/i,
    /clientplatform/i,
    /clientmodule/i,
    /clientplugin/i,
    /clientmodevents/i,
    /clientevents/i,
    /clientbootstrap/i,
    /clientinitializer/i
];
const BOOTSTRAP_NAME_PATTERNS = [
    /clientmod/i,
    /clientevents/i,
    /clientplatform/i,
    /overlay/i,
    /tooltip/i,
    /renderer/i,
    /keybind/i,
    /screen/i
];
const MIXIN_TARGET_HINT_PATTERNS = [
    'net/minecraft/client/',
    'net/minecraftforge/client/',
    'com/mojang/blaze3d/'
];
const MAX_ANALYZED_CLASSES = 192;

function normalize(value: unknown): string {
    return String(value || '').trim().toLowerCase();
}

function includesAny(value: string, patterns: string[]): boolean {
    return patterns.some((pattern) => value.includes(pattern));
}

function pushUnique(target: string[], value: string, limit = 12): void {
    if (!value || target.includes(value) || target.length >= limit) {
        return;
    }

    target.push(value);
}

function addKind(target: Set<string>, value: string): void {
    if (value) {
        target.add(value);
    }
}

function collectServiceEntries(archive: ArchiveHandle): string[] {
    return (archive.entries || []).filter((entry) => normalize(entry).startsWith('meta-inf/services/'));
}

function summarizeClientSignatures({
    archive,
    descriptor
}: {
    archive: ArchiveHandle;
    descriptor?: ModDescriptor | null;
}): ClientSignatureIndex | null {
    const classEntries = (archive.entries || []).filter((entry) => entry.endsWith('.class'));
    const serviceEntries = collectServiceEntries(archive);

    if (classEntries.length === 0 && serviceEntries.length === 0) {
        return null;
    }

    const rootClassNames = selectRootClasses(classEntries, descriptor);
    const rootSet = new Set(rootClassNames);
    const prioritizedEntries = [
        ...rootClassNames,
        ...classEntries.filter((entry) => !rootSet.has(entry))
    ].slice(0, MAX_ANALYZED_CLASSES);

    const summary: ClientSignatureIndex = {
        analyzedClassCount: 0,
        rootClassNames,
        clientApiExtendsCount: 0,
        clientApiImplementsCount: 0,
        clientMethodSignatureCount: 0,
        clientFieldSignatureCount: 0,
        forgeClientEventHitCount: 0,
        serviceClientAdapterCount: 0,
        mixinClientTargetCount: 0,
        clientBootstrapPatternCount: 0,
        signatureKinds: [],
        evidenceSamples: []
    };
    const signatureKinds = new Set<string>();

    for (const entry of prioritizedEntries) {
        const buffer = archive.readEntry(entry);

        if (!buffer) {
            continue;
        }

        summary.analyzedClassCount += 1;
        const parsed = parseClassSignatures(buffer);
        const className = normalize(parsed.className || entry.replace(/\.class$/i, ''));
        const superClassName = normalize(parsed.superClassName);
        const interfaceNames: string[] = parsed.interfaceNames.map((value: string) => normalize(value));
        const fieldDescriptors: string[] = parsed.fieldDescriptors.map((value: string) => normalize(value));
        const methodDescriptors: string[] = parsed.methodDescriptors.map((value: string) => normalize(value));
        const utf8Values: string[] = parsed.utf8Values.map((value: string) => normalize(value));
        const classNamesFromPool: string[] = parsed.classNames.map((value: string) => normalize(value));
        const isRootClass = rootSet.has(entry);
        const combinedValues = [
            className,
            superClassName,
            ...interfaceNames,
            ...fieldDescriptors,
            ...methodDescriptors,
            ...utf8Values,
            ...classNamesFromPool
        ];

        if (isRootClass && includesAny(superClassName, [...GUI_SIGNATURE_PATTERNS, ...RENDER_SIGNATURE_PATTERNS, ...AUDIO_SIGNATURE_PATTERNS])) {
            summary.clientApiExtendsCount += 1;
            addKind(signatureKinds, includesAny(superClassName, GUI_SIGNATURE_PATTERNS) ? 'gui-api' : includesAny(superClassName, RENDER_SIGNATURE_PATTERNS) ? 'render-api' : 'audio-api');
            pushUnique(summary.evidenceSamples, `${entry} extends ${parsed.superClassName}`);
        }

        const clientInterfaces = interfaceNames.filter((value: string) => includesAny(value, [...GUI_SIGNATURE_PATTERNS, ...RENDER_SIGNATURE_PATTERNS, ...AUDIO_SIGNATURE_PATTERNS, ...INPUT_SIGNATURE_PATTERNS]));

        if (isRootClass && clientInterfaces.length > 0) {
            summary.clientApiImplementsCount += clientInterfaces.length;
            for (const signature of clientInterfaces) {
                addKind(signatureKinds, includesAny(signature, GUI_SIGNATURE_PATTERNS) ? 'gui-api' : includesAny(signature, RENDER_SIGNATURE_PATTERNS) ? 'render-api' : includesAny(signature, AUDIO_SIGNATURE_PATTERNS) ? 'audio-api' : 'input-api');
            }
            pushUnique(summary.evidenceSamples, `${entry} implements ${clientInterfaces[0]}`);
        }

        const clientMethodHits = methodDescriptors.filter((value: string) => includesAny(value, [...GUI_SIGNATURE_PATTERNS, ...RENDER_SIGNATURE_PATTERNS, ...AUDIO_SIGNATURE_PATTERNS, ...INPUT_SIGNATURE_PATTERNS]));

        if (isRootClass && clientMethodHits.length > 0) {
            summary.clientMethodSignatureCount += clientMethodHits.length;
            for (const signature of clientMethodHits) {
                addKind(signatureKinds, includesAny(signature, GUI_SIGNATURE_PATTERNS) ? 'gui-api' : includesAny(signature, RENDER_SIGNATURE_PATTERNS) ? 'render-api' : includesAny(signature, AUDIO_SIGNATURE_PATTERNS) ? 'audio-api' : 'input-api');
            }
            pushUnique(summary.evidenceSamples, `${entry} method ${clientMethodHits[0]}`);
        }

        const clientFieldHits = fieldDescriptors.filter((value: string) => includesAny(value, [...GUI_SIGNATURE_PATTERNS, ...RENDER_SIGNATURE_PATTERNS, ...AUDIO_SIGNATURE_PATTERNS, ...INPUT_SIGNATURE_PATTERNS]));

        if (isRootClass && clientFieldHits.length > 0) {
            summary.clientFieldSignatureCount += clientFieldHits.length;
            for (const signature of clientFieldHits) {
                addKind(signatureKinds, includesAny(signature, GUI_SIGNATURE_PATTERNS) ? 'gui-api' : includesAny(signature, RENDER_SIGNATURE_PATTERNS) ? 'render-api' : includesAny(signature, AUDIO_SIGNATURE_PATTERNS) ? 'audio-api' : 'input-api');
            }
            pushUnique(summary.evidenceSamples, `${entry} field ${clientFieldHits[0]}`);
        }

        const forgeClientEvents = combinedValues.filter((value) => includesAny(value, FORGE_CLIENT_EVENT_PATTERNS));

        if (isRootClass && forgeClientEvents.length > 0) {
            summary.forgeClientEventHitCount += forgeClientEvents.length;
            addKind(signatureKinds, 'forge-client-event');
            pushUnique(summary.evidenceSamples, `${entry} event ${forgeClientEvents[0]}`);
        }

        const bootstrapHits = combinedValues.filter((value) => BOOTSTRAP_NAME_PATTERNS.some((pattern) => pattern.test(value)));

        if (isRootClass && bootstrapHits.length > 0) {
            summary.clientBootstrapPatternCount += 1;
            addKind(signatureKinds, 'client-bootstrap-pattern');
            pushUnique(summary.evidenceSamples, `${entry} bootstrap ${bootstrapHits[0]}`);
        }

        const isMixinClass = className.includes('/mixin/') || normalize(entry).includes('/mixin/');
        const mixinClientTargets = isMixinClass
            ? combinedValues.filter((value) => includesAny(value, MIXIN_TARGET_HINT_PATTERNS))
            : [];

        if (mixinClientTargets.length > 0) {
            summary.mixinClientTargetCount += mixinClientTargets.length;
            addKind(signatureKinds, 'mixin-client-target');
            pushUnique(summary.evidenceSamples, `${entry} mixin ${mixinClientTargets[0]}`);
        }
    }

    for (const entry of serviceEntries) {
        const normalizedEntry = normalize(entry);
        const serviceName = entry.replace(/^META-INF\/services\//i, '');
        let matched = SERVICE_CLIENT_PATTERNS.some((pattern) => pattern.test(normalizedEntry) || pattern.test(serviceName));

        if (!matched) {
            const content = archive.readEntry(entry);

            if (content) {
                const text = content.toString('utf8');
                matched = SERVICE_CLIENT_PATTERNS.some((pattern) => pattern.test(text));
            }
        }

        if (!matched) {
            continue;
        }

        summary.serviceClientAdapterCount += 1;
        addKind(signatureKinds, 'service-client-adapter');
        pushUnique(summary.evidenceSamples, `service ${serviceName}`);
    }

    summary.signatureKinds = [...signatureKinds].sort();

    if (
        summary.clientApiExtendsCount === 0
        && summary.clientApiImplementsCount === 0
        && summary.clientMethodSignatureCount === 0
        && summary.clientFieldSignatureCount === 0
        && summary.forgeClientEventHitCount === 0
        && summary.serviceClientAdapterCount === 0
        && summary.mixinClientTargetCount === 0
        && summary.clientBootstrapPatternCount === 0
    ) {
        return null;
    }

    return summary;
}

module.exports = {
    summarizeClientSignatures
};
