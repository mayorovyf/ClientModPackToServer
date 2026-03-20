const fs = require('node:fs');
const path = require('node:path');

import type { ServerCoreType } from '../server/types';
import type { LoaderKind } from '../types/metadata';
import type { PackRuntimeDetection } from '../types/runtime-detection';
import type { RunContext } from '../types/run';

const SUPPORTED_SERVER_CORE_BY_LOADER: Partial<Record<LoaderKind, ServerCoreType>> = {
    fabric: 'fabric',
    forge: 'forge',
    neoforge: 'neoforge'
};

interface ParsedDecisionLike {
    descriptor?: {
        loader?: LoaderKind | 'unknown';
        dependencies?: Array<{
            modId?: string | null;
            versionRange?: string | null;
        }>;
        optionalDependencies?: Array<{
            modId?: string | null;
            versionRange?: string | null;
        }>;
        manifestHints?: Record<string, string>;
    } | null;
}

interface InstanceRuntimeHints {
    source: 'instance-manifest';
    loader: LoaderKind | null;
    loaderVersion: string | null;
    minecraftVersion: string | null;
    evidence: string[];
    warnings: string[];
}

function normalizeString(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null;
    }

    const normalized = String(value).trim();
    return normalized ? normalized : null;
}

function isSupportedLoader(value: string | null): value is LoaderKind {
    return value === 'fabric' || value === 'quilt' || value === 'forge' || value === 'neoforge';
}

function mapComponentUidToLoader(uid: string | null): LoaderKind | null {
    switch (uid) {
        case 'net.fabricmc.fabric-loader':
            return 'fabric';
        case 'org.quiltmc.quilt-loader':
            return 'quilt';
        case 'net.minecraftforge':
            return 'forge';
        case 'net.neoforged.neoforge':
        case 'net.neoforged':
            return 'neoforge';
        default:
            return null;
    }
}

function listRuntimeManifestCandidates(runContext: RunContext): string[] {
    const candidates = new Set<string>([
        path.join(runContext.instancePath, 'mmc-pack.json'),
        path.join(path.dirname(runContext.instancePath), 'mmc-pack.json')
    ]);

    return [...candidates];
}

function readInstanceRuntimeHints(runContext: RunContext): InstanceRuntimeHints | null {
    for (const candidatePath of listRuntimeManifestCandidates(runContext)) {
        if (!fs.existsSync(candidatePath)) {
            continue;
        }

        try {
            const raw = JSON.parse(fs.readFileSync(candidatePath, 'utf8')) as {
                components?: Array<Record<string, unknown>>;
            };
            const components = Array.isArray(raw.components)
                ? raw.components.filter((item) => item && typeof item === 'object')
                : [];
            let loader: LoaderKind | null = null;
            let loaderVersion: string | null = null;
            let minecraftVersion: string | null = null;
            const evidence = [`Resolved instance manifest: ${candidatePath}`];

            for (const component of components) {
                const uid = normalizeString(component.uid);
                const version = normalizeString(component.version);

                if (uid === 'net.minecraft' && version) {
                    minecraftVersion = version;
                    evidence.push(`Minecraft ${version} from ${uid}`);
                    continue;
                }

                const mappedLoader = mapComponentUidToLoader(uid);

                if (mappedLoader && version) {
                    loader = mappedLoader;
                    loaderVersion = version;
                    evidence.push(`Loader ${mappedLoader} ${version} from ${uid}`);
                }
            }

            if (!loader && !minecraftVersion) {
                continue;
            }

            return {
                source: 'instance-manifest',
                loader,
                loaderVersion,
                minecraftVersion,
                evidence,
                warnings: []
            };
        } catch (error) {
            return {
                source: 'instance-manifest',
                loader: null,
                loaderVersion: null,
                minecraftVersion: null,
                evidence: [`Resolved instance manifest: ${candidatePath}`],
                warnings: [`Failed to parse instance manifest ${candidatePath}: ${error instanceof Error ? error.message : String(error)}`]
            };
        }
    }

    return null;
}

function countValues(values: Array<string | null | undefined>): Map<string, number> {
    const counts = new Map<string, number>();

    for (const value of values) {
        const normalized = normalizeString(value);

        if (!normalized) {
            continue;
        }

        counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }

    return counts;
}

function pickMostFrequent(values: Array<string | null | undefined>): string | null {
    const counts = [...countValues(values).entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));

    return counts[0]?.[0] || null;
}

function collectDependencyVersionCandidates(descriptor: ParsedDecisionLike['descriptor'], dependencyId: string): string[] {
    const dependencyGroups = [
        ...(descriptor?.dependencies || []),
        ...(descriptor?.optionalDependencies || [])
    ];

    return dependencyGroups
        .filter((dependency) => normalizeString(dependency?.modId)?.toLowerCase() === dependencyId)
        .map((dependency) => normalizeString(dependency?.versionRange))
        .filter((value): value is string => Boolean(value));
}

function collectDescriptorRuntimeHints(decisions: ParsedDecisionLike[]) {
    const loaderCounts = new Map<LoaderKind, number>();
    const loaderVersionCandidates: Record<LoaderKind, string[]> = {
        fabric: [],
        quilt: [],
        forge: [],
        neoforge: [],
        unknown: []
    };
    const minecraftVersionCandidates: string[] = [];
    const evidence: string[] = [];
    const warnings: string[] = [];

    for (const decision of decisions) {
        const descriptor = decision?.descriptor;
        const loader = descriptor?.loader;

        if (loader && loader !== 'unknown') {
            loaderCounts.set(loader, (loaderCounts.get(loader) || 0) + 1);
        }

        minecraftVersionCandidates.push(...collectDependencyVersionCandidates(descriptor, 'minecraft'));

        switch (loader) {
            case 'fabric':
                loaderVersionCandidates.fabric.push(...collectDependencyVersionCandidates(descriptor, 'fabricloader'));
                break;
            case 'quilt':
                loaderVersionCandidates.quilt.push(
                    ...collectDependencyVersionCandidates(descriptor, 'quilt_loader'),
                    ...collectDependencyVersionCandidates(descriptor, 'quilt-loader')
                );
                break;
            case 'forge':
                loaderVersionCandidates.forge.push(...collectDependencyVersionCandidates(descriptor, 'forge'));
                if (normalizeString(descriptor?.manifestHints?.loaderVersion)) {
                    loaderVersionCandidates.forge.push(normalizeString(descriptor?.manifestHints?.loaderVersion) as string);
                }
                break;
            case 'neoforge':
                loaderVersionCandidates.neoforge.push(...collectDependencyVersionCandidates(descriptor, 'neoforge'));
                if (normalizeString(descriptor?.manifestHints?.loaderVersion)) {
                    loaderVersionCandidates.neoforge.push(normalizeString(descriptor?.manifestHints?.loaderVersion) as string);
                }
                break;
            default:
                break;
        }
    }

    const sortedLoaderCounts = [...loaderCounts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
    const topLoader = sortedLoaderCounts[0]?.[0] || null;
    const secondLoader = sortedLoaderCounts[1]?.[0] || null;
    const totalKnownLoaderDescriptors = sortedLoaderCounts.reduce((sum, [, count]) => sum + count, 0);
    let loader: LoaderKind | null = null;
    let status: 'detected' | 'ambiguous' | 'unknown' = 'unknown';

    if (sortedLoaderCounts.length === 1 && topLoader) {
        loader = topLoader;
        status = 'detected';
        evidence.push(`All parsed mod descriptors point to loader ${topLoader}`);
    } else if (sortedLoaderCounts.length > 1 && topLoader) {
        loader = topLoader;
        status = 'ambiguous';
        warnings.push(`Mixed loaders detected: ${sortedLoaderCounts.map(([name, count]) => `${name}=${count}`).join(', ')}`);
        evidence.push(`Dominant loader ${topLoader} selected from ${totalKnownLoaderDescriptors} known descriptors`);
        if (secondLoader) {
            evidence.push(`Secondary loader candidate ${secondLoader} was also present`);
        }
    }

    const loaderVersion = loader ? pickMostFrequent(loaderVersionCandidates[loader]) : null;
    const minecraftVersion = pickMostFrequent(minecraftVersionCandidates);

    if (loaderVersion && loader) {
        evidence.push(`Loader version hint ${loaderVersion} inferred from ${loader} mod metadata`);
    }

    if (minecraftVersion) {
        evidence.push(`Minecraft version hint ${minecraftVersion} inferred from mod metadata`);
    }

    return {
        status,
        loader,
        loaderVersion,
        minecraftVersion,
        evidence,
        warnings
    };
}

function resolveConfidence({
    source,
    status,
    loader,
    minecraftVersion
}: {
    source: PackRuntimeDetection['source'];
    status: PackRuntimeDetection['status'];
    loader: LoaderKind | null;
    minecraftVersion: string | null;
}): PackRuntimeDetection['confidence'] {
    if (source === 'instance-manifest' || source === 'mixed') {
        return loader && minecraftVersion ? 'high' : 'medium';
    }

    if (status === 'detected' && loader && minecraftVersion) {
        return 'medium';
    }

    return 'low';
}

function mergeEvidence(...groups: string[][]): string[] {
    return [...new Set(groups.flat().filter(Boolean))];
}

function mergeWarnings(...groups: string[][]): string[] {
    return [...new Set(groups.flat().filter(Boolean))];
}

function getSupportedServerCore(loader: LoaderKind | null): ServerCoreType | null {
    return loader ? (SUPPORTED_SERVER_CORE_BY_LOADER[loader] || null) : null;
}

function detectPackRuntime({
    runContext,
    decisions
}: {
    runContext: RunContext;
    decisions: ParsedDecisionLike[];
}): PackRuntimeDetection {
    const instanceHints = readInstanceRuntimeHints(runContext);
    const descriptorHints = collectDescriptorRuntimeHints(decisions);
    const loader = instanceHints?.loader || descriptorHints.loader || null;
    const source: PackRuntimeDetection['source'] = instanceHints && descriptorHints.loader
        ? 'mixed'
        : instanceHints
            ? 'instance-manifest'
            : descriptorHints.loader
                ? 'mod-metadata'
                : 'none';
    const warnings = mergeWarnings(instanceHints?.warnings || [], descriptorHints.warnings);

    if (instanceHints?.loader && descriptorHints.loader && instanceHints.loader !== descriptorHints.loader) {
        warnings.push(`Instance manifest reports loader ${instanceHints.loader}, but mod metadata looks like ${descriptorHints.loader}`);
    }

    const status: PackRuntimeDetection['status'] = loader
        ? (descriptorHints.status === 'ambiguous' && !instanceHints?.loader ? 'ambiguous' : 'detected')
        : 'unknown';
    const loaderVersion = instanceHints?.loader && instanceHints.loader === loader
        ? (instanceHints.loaderVersion || descriptorHints.loaderVersion)
        : (instanceHints?.loaderVersion || descriptorHints.loaderVersion || null);
    const minecraftVersion = instanceHints?.minecraftVersion || descriptorHints.minecraftVersion || null;
    const supportedServerCore = getSupportedServerCore(loader);
    const evidence = mergeEvidence(instanceHints?.evidence || [], descriptorHints.evidence);

    if (!minecraftVersion) {
        warnings.push('Minecraft version could not be detected from the instance manifest or mod metadata');
    }

    if (loader === 'quilt') {
        warnings.push('Quilt was detected, but automatic managed server core installation is not available for this loader');
    }

    return {
        status,
        source,
        confidence: resolveConfidence({
            source,
            status,
            loader,
            minecraftVersion
        }),
        loader,
        loaderVersion,
        minecraftVersion,
        supportedServerCore,
        evidence,
        warnings: [...new Set(warnings)]
    };
}

module.exports = {
    detectPackRuntime
};
