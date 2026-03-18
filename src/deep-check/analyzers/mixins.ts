import type { MixinAnalysis } from '../../types/deep-check';

function pushUnique(list: string[], item: string): void {
    if (!list.includes(item)) {
        list.push(item);
    }
}

function analyzeMixinPath(value: unknown, target: string[]): void {
    const normalized = String(value || '').trim().toLowerCase();

    if (!normalized) {
        return;
    }

    if (normalized.includes('net.minecraft.client') || normalized.includes('.client.') || normalized.includes('/client/')) {
        pushUnique(target, String(value));
    }
}

function analyzeMixins({
    archive,
    descriptor
}: {
    archive: { readText(entryPath: string): string | null };
    descriptor: { mixinConfigs?: string[] } | null | undefined;
}): MixinAnalysis {
    const mixinConfigs: string[] = descriptor && Array.isArray(descriptor.mixinConfigs) ? descriptor.mixinConfigs : [];
    const summary: MixinAnalysis = {
        totalConfigs: mixinConfigs.length,
        parsedConfigs: 0,
        missingConfigs: [],
        invalidConfigs: [],
        clientConfigNameHits: [],
        clientPackageHits: [],
        clientSectionHits: [],
        clientTargetHits: [],
        commonMixins: [],
        warnings: [],
        hasOnlyClientMixins: false
    };

    for (const configName of mixinConfigs) {
        const normalizedConfigName = String(configName || '').trim().toLowerCase();

        if (normalizedConfigName.includes('client')) {
            pushUnique(summary.clientConfigNameHits, configName);
        }

        const raw = archive.readText(configName);

        if (raw === null) {
            summary.missingConfigs.push(configName);
            summary.warnings.push(`Mixin config not found in archive: ${configName}`);
            continue;
        }

        let parsed: Record<string, unknown>;

        try {
            parsed = JSON.parse(raw);
        } catch {
            summary.invalidConfigs.push(configName);
            summary.warnings.push(`Mixin config is not valid JSON: ${configName}`);
            continue;
        }

        summary.parsedConfigs += 1;

        if (parsed.package) {
            analyzeMixinPath(parsed.package, summary.clientPackageHits);
        }

        for (const entry of Array.isArray(parsed.client) ? parsed.client : []) {
            summary.clientSectionHits.push(`${configName}:${entry}`);
            analyzeMixinPath(entry, summary.clientTargetHits);
        }

        for (const entry of Array.isArray(parsed.mixins) ? parsed.mixins : []) {
            summary.commonMixins.push(`${configName}:${entry}`);
            analyzeMixinPath(entry, summary.clientTargetHits);
        }

        for (const entry of Array.isArray(parsed.server) ? parsed.server : []) {
            summary.commonMixins.push(`${configName}:${entry}`);
        }

        if (Array.isArray(parsed.targets)) {
            for (const entry of parsed.targets) {
                analyzeMixinPath(entry, summary.clientTargetHits);
            }
        }
    }

    summary.hasOnlyClientMixins = (
        summary.clientSectionHits.length > 0
        && summary.commonMixins.length === 0
        && summary.clientTargetHits.length >= summary.clientSectionHits.length
    ) || (
        summary.clientConfigNameHits.length > 0
        && summary.commonMixins.length === 0
        && summary.clientSectionHits.length > 0
    );

    return summary;
}

module.exports = {
    analyzeMixins
};
