const { DECLARED_SIDES, LOADER_TYPES } = require('../../metadata/constants');
const { CONFIDENCE_LEVELS, ENGINE_DECISIONS } = require('../constants');

import type { ClassificationEngine, ConfidenceLevel, EngineEvidence, RoleType } from '../../types/classification';
import type { ArchiveHintCategory, ModDescriptor } from '../../types/descriptor';

const UI_PATTERNS = [
    /screen/i,
    /gui/i,
    /menu/i,
    /tooltip/i,
    /overlay/i,
    /widget/i,
    /advancement/i,
    /toast/i,
    /inventory/i,
    /configured/i
];
const VISUAL_PATTERNS = [/render/i, /shader/i, /model/i, /texture/i, /particle/i, /visual/i, /blur/i, /oculus/i];
const QOL_PATTERNS = [/crosshair/i, /minimap/i, /worldmap/i, /waypoint/i, /chat/i, /keybind/i, /f3/i, /appleskin/i, /controlling/i];
const OPTIMIZATION_PATTERNS = [/optimi[sz]/i, /modernfix/i, /smooth/i, /memory/i, /performance/i, /fps/i, /cache/i];
const LIBRARY_PATTERNS = [/(^|[-_/])(lib|library|api|core|common)([-_/]|$)/i, /framework/i, /platform/i, /konkrete/i, /iceberg/i];
const COMPAT_PATTERNS = [/compat/i, /integration/i, /bridge/i, /connector/i];
const CLIENT_DEPENDENCY_IDS = new Set(['embeddium', 'oculus', 'jei', 'configured', 'catalogue']);

function isForgeLike(descriptor: ModDescriptor): boolean {
    return descriptor.loader === LOADER_TYPES.forge || descriptor.loader === LOADER_TYPES.neoforge;
}

function buildSearchText(descriptor: ModDescriptor): string {
    return [
        descriptor.fileName,
        descriptor.displayName,
        ...descriptor.modIds,
        ...descriptor.provides,
        ...descriptor.mixinConfigs,
        ...Object.keys(descriptor.manifestHints || {}),
        ...Object.values(descriptor.manifestHints || {})
    ]
        .filter(Boolean)
        .join(' ');
}

function addPatternCategory(text: string, category: ArchiveHintCategory, patterns: RegExp[], categories: Set<ArchiveHintCategory>): void {
    if (patterns.some((pattern) => pattern.test(text))) {
        categories.add(category);
    }
}

function collectCategories(descriptor: ModDescriptor): Set<ArchiveHintCategory> {
    const categories = new Set<ArchiveHintCategory>(descriptor.archiveIndex?.hintCategories || []);
    const searchText = buildSearchText(descriptor);

    addPatternCategory(searchText, 'ui', UI_PATTERNS, categories);
    addPatternCategory(searchText, 'visual', VISUAL_PATTERNS, categories);
    addPatternCategory(searchText, 'qol', QOL_PATTERNS, categories);
    addPatternCategory(searchText, 'optimization', OPTIMIZATION_PATTERNS, categories);
    addPatternCategory(searchText, 'library', LIBRARY_PATTERNS, categories);
    addPatternCategory(searchText, 'compat', COMPAT_PATTERNS, categories);

    return categories;
}

function determineClientRole(categories: Set<ArchiveHintCategory>): RoleType {
    if (categories.has('ui')) {
        return 'client-ui';
    }

    if (categories.has('visual')) {
        return 'client-visual';
    }

    if (categories.has('library')) {
        return 'client-library';
    }

    return 'client-qol';
}

function determineCommonRole(categories: Set<ArchiveHintCategory>): RoleType {
    if (categories.has('optimization')) {
        return 'common-optimization';
    }

    if (categories.has('library')) {
        return 'common-library';
    }

    return 'common-gameplay';
}

function determineConfidence(score: number): ConfidenceLevel {
    if (score >= 10) {
        return CONFIDENCE_LEVELS.high;
    }

    if (score >= 6) {
        return CONFIDENCE_LEVELS.medium;
    }

    if (score >= 3) {
        return CONFIDENCE_LEVELS.low;
    }

    return CONFIDENCE_LEVELS.none;
}

function createEvidence(type: string, value: string, source: string): EngineEvidence {
    return {
        type,
        value,
        source
    };
}

function summarizeCategoryEvidence(categories: Set<ArchiveHintCategory>): EngineEvidence[] {
    return [...categories].map((category) => createEvidence('hint-category', category, 'forge-semantic-engine'));
}

function evaluateForgeSemanticSignals(descriptor: ModDescriptor): {
    clientScore: number;
    commonScore: number;
    clientHardSignals: number;
    commonHardSignals: number;
    categories: Set<ArchiveHintCategory>;
    evidence: EngineEvidence[];
} {
    const categories = collectCategories(descriptor);
    const evidence: EngineEvidence[] = summarizeCategoryEvidence(categories);
    let clientScore = 0;
    let commonScore = 0;
    let clientHardSignals = 0;
    let commonHardSignals = 0;

    if (descriptor.declaredSide === DECLARED_SIDES.client) {
        clientScore += 8;
        clientHardSignals += 2;
        evidence.push(createEvidence('declared-side', descriptor.declaredSide, 'normalized-descriptor'));
    } else if (descriptor.declaredSide === DECLARED_SIDES.server || descriptor.declaredSide === DECLARED_SIDES.both) {
        commonScore += 7;
        commonHardSignals += 2;
        evidence.push(createEvidence('declared-side', descriptor.declaredSide, 'normalized-descriptor'));
    }

    const allDependencies = [...descriptor.dependencies, ...descriptor.optionalDependencies];
    const clientDependencies = allDependencies.filter((dependency) =>
        dependency.sideHint === DECLARED_SIDES.client || CLIENT_DEPENDENCY_IDS.has(String(dependency.modId || '').toLowerCase())
    );
    const commonDependencies = allDependencies.filter((dependency) =>
        dependency.sideHint === DECLARED_SIDES.both || dependency.sideHint === DECLARED_SIDES.server
    );

    if (clientDependencies.length > 0) {
        clientHardSignals += 1;
        clientScore += Math.min(4, 2 + clientDependencies.length);
        evidence.push(
            createEvidence(
                'dependency-side',
                `client:${clientDependencies.map((dependency) => dependency.modId).filter(Boolean).join(', ')}`,
                'mods.toml'
            )
        );
    }

    if (commonDependencies.length > 0) {
        commonHardSignals += 1;
        commonScore += Math.min(4, 2 + commonDependencies.length);
        evidence.push(
            createEvidence(
                'dependency-side',
                `common:${commonDependencies.map((dependency) => dependency.modId).filter(Boolean).join(', ')}`,
                'mods.toml'
            )
        );
    }

    if (descriptor.archiveIndex?.hasClientCodeReferences) {
        clientHardSignals += 1;
        clientScore += descriptor.archiveIndex.clientReferenceCount >= 3 ? 5 : 4;
        evidence.push(
            createEvidence(
                'archive-client-refs',
                String(descriptor.archiveIndex.clientReferenceCount),
                'archive-index'
            )
        );
    }

    if (categories.has('ui')) {
        clientScore += 2;
    }

    if (categories.has('visual')) {
        clientScore += 2;
    }

    if (categories.has('qol')) {
        clientScore += 2;
    }

    if (categories.has('optimization')) {
        commonScore += 2;
    }

    if (categories.has('library')) {
        if (clientHardSignals > commonHardSignals) {
            clientScore += 1;
        } else {
            commonScore += 2;
        }
    }

    if (categories.has('compat')) {
        clientScore += 1;
        commonScore += 1;
    }

    return {
        clientScore,
        commonScore,
        clientHardSignals,
        commonHardSignals,
        categories,
        evidence
    };
}

const forgeSemanticEngine: ClassificationEngine = {
    name: 'forge-semantic-engine',
    classify({ descriptor }) {
        if (!isForgeLike(descriptor)) {
            return {
                decision: ENGINE_DECISIONS.unknown,
                confidence: CONFIDENCE_LEVELS.none,
                reason: 'Forge semantic analysis only applies to Forge and NeoForge jars'
            };
        }

        if (descriptor.parsingErrors.some((item) => item.fatal)) {
            return {
                decision: ENGINE_DECISIONS.unknown,
                confidence: CONFIDENCE_LEVELS.none,
                reason: 'Forge semantic analysis skipped because metadata parsing failed'
            };
        }

        const signalState = evaluateForgeSemanticSignals(descriptor);
        const clientConfidence = determineConfidence(signalState.clientScore);
        const commonConfidence = determineConfidence(signalState.commonScore);

        if (
            signalState.clientHardSignals >= 2
            && signalState.clientScore >= 7
            && signalState.commonScore <= 2
        ) {
            const roleType = determineClientRole(signalState.categories);

            return {
                decision: ENGINE_DECISIONS.remove,
                confidence: clientConfidence,
                reason: 'Forge semantic analysis found strong client-only initialization signals',
                roleType,
                roleConfidence: clientConfidence,
                roleReason: 'Strong client-only Forge signals were detected',
                evidence: signalState.evidence
            };
        }

        if (
            signalState.commonHardSignals >= 1
            && signalState.commonScore >= 5
            && signalState.clientHardSignals === 0
        ) {
            const roleType = determineCommonRole(signalState.categories);

            return {
                decision: ENGINE_DECISIONS.keep,
                confidence: commonConfidence,
                reason: 'Forge semantic analysis found common-side dependency or gameplay signals',
                roleType,
                roleConfidence: commonConfidence,
                roleReason: 'Forge semantic analysis found shared/common signals',
                evidence: signalState.evidence
            };
        }

        if (
            signalState.clientHardSignals > 0
            && signalState.commonHardSignals > 0
        ) {
            return {
                decision: ENGINE_DECISIONS.unknown,
                confidence: CONFIDENCE_LEVELS.low,
                reason: 'Forge semantic analysis found mixed client and common signals',
                roleType: signalState.categories.has('compat') ? 'compat-client' : 'unknown',
                roleConfidence: CONFIDENCE_LEVELS.low,
                roleReason: 'Mixed Forge-side signals need a deeper classifier',
                evidence: signalState.evidence
            };
        }

        if (signalState.clientHardSignals > 0 && signalState.clientScore >= 6) {
            const roleType = determineClientRole(signalState.categories);

            return {
                decision: ENGINE_DECISIONS.remove,
                confidence: CONFIDENCE_LEVELS.medium,
                reason: 'Forge semantic analysis found likely client-only behavior',
                roleType,
                roleConfidence: CONFIDENCE_LEVELS.medium,
                roleReason: 'Client-oriented Forge signals dominate this jar',
                evidence: signalState.evidence
            };
        }

        if (signalState.commonHardSignals > 0 && signalState.commonScore >= 4 && signalState.clientScore <= 3) {
            const roleType = determineCommonRole(signalState.categories);

            return {
                decision: ENGINE_DECISIONS.keep,
                confidence: CONFIDENCE_LEVELS.medium,
                reason: 'Forge semantic analysis found likely common-side behavior',
                roleType,
                roleConfidence: CONFIDENCE_LEVELS.medium,
                roleReason: 'Common/shared Forge signals dominate this jar',
                evidence: signalState.evidence
            };
        }

        if (signalState.clientScore > 0 || signalState.commonScore > 0) {
            const roleType = signalState.clientScore > signalState.commonScore
                ? determineClientRole(signalState.categories)
                : signalState.commonScore > signalState.clientScore
                    ? determineCommonRole(signalState.categories)
                    : signalState.categories.has('compat')
                        ? 'compat-client'
                        : 'unknown';
            const roleConfidence = signalState.clientScore === signalState.commonScore
                ? CONFIDENCE_LEVELS.low
                : signalState.clientScore > signalState.commonScore
                    ? clientConfidence
                    : commonConfidence;

            return {
                decision: ENGINE_DECISIONS.unknown,
                confidence: CONFIDENCE_LEVELS.low,
                reason: 'Forge semantic analysis collected hints, but they are not decisive yet',
                roleType,
                roleConfidence,
                roleReason: 'Partial Forge-side hints were collected',
                evidence: signalState.evidence
            };
        }

        return {
            decision: ENGINE_DECISIONS.unknown,
            confidence: CONFIDENCE_LEVELS.none,
            reason: 'Forge semantic analysis did not find useful side signals',
            roleType: 'unknown',
            roleConfidence: CONFIDENCE_LEVELS.none,
            roleReason: null
        };
    }
};

module.exports = {
    forgeSemanticEngine
};
