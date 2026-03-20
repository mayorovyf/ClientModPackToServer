const { LOADER_TYPES } = require('../../metadata/constants');
const { CONFIDENCE_LEVELS, ENGINE_DECISIONS } = require('../constants');

import type { ClassificationEngine, EngineEvidence, RoleType } from '../../types/classification';
import type { ArchiveHintCategory, ModDescriptor } from '../../types/descriptor';

function isForgeLike(descriptor: ModDescriptor): boolean {
    return descriptor.loader === LOADER_TYPES.forge || descriptor.loader === LOADER_TYPES.neoforge;
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

function collectCategories(descriptor: ModDescriptor): Set<ArchiveHintCategory> {
    return new Set(descriptor.archiveIndex?.hintCategories || []);
}

function buildEvidence(descriptor: ModDescriptor): EngineEvidence[] {
    const bytecode = descriptor.archiveIndex?.bytecode;

    if (!bytecode) {
        return [];
    }

    return [
        {
            type: 'bytecode-roots',
            value: bytecode.rootClasses.slice(0, 6).join(', ') || 'n/a',
            source: 'archive-index'
        },
        {
            type: 'bytecode-counts',
            value: `root client=${bytecode.rootClientReferenceCount}, root common=${bytecode.rootCommonReferenceCount}, root server=${bytecode.rootServerReferenceCount}, deep client=${bytecode.deepClientReferenceCount}`,
            source: 'archive-index'
        },
        ...bytecode.rootClientReferenceSamples.slice(0, 2).map((value) => ({
            type: 'bytecode-root-client',
            value,
            source: 'archive-index'
        })),
        ...bytecode.rootCommonReferenceSamples.slice(0, 2).map((value) => ({
            type: 'bytecode-root-common',
            value,
            source: 'archive-index'
        })),
        ...bytecode.rootServerReferenceSamples.slice(0, 2).map((value) => ({
            type: 'bytecode-root-server',
            value,
            source: 'archive-index'
        }))
    ];
}

const forgeBytecodeEngine: ClassificationEngine = {
    name: 'forge-bytecode-engine',
    classify({ descriptor }) {
        if (!isForgeLike(descriptor)) {
            return {
                decision: ENGINE_DECISIONS.unknown,
                confidence: CONFIDENCE_LEVELS.none,
                reason: 'Forge bytecode analysis only applies to Forge and NeoForge jars'
            };
        }

        const bytecode = descriptor.archiveIndex?.bytecode;

        if (!bytecode || bytecode.analyzedClassCount === 0) {
            return {
                decision: ENGINE_DECISIONS.unknown,
                confidence: CONFIDENCE_LEVELS.none,
                reason: 'Forge bytecode analysis could not collect class reachability data'
            };
        }

        const categories = collectCategories(descriptor);
        const evidence = buildEvidence(descriptor);
        const hasMixedRootSignals = bytecode.rootClientReferenceCount > 0
            && (bytecode.rootCommonReferenceCount > 0 || bytecode.rootServerReferenceCount > 0);
        const hasStrongClientRoots = bytecode.rootClientReferenceCount >= 2
            && bytecode.rootCommonReferenceCount === 0
            && bytecode.rootServerReferenceCount === 0;
        const hasLikelyClientRoots = bytecode.rootClientReferenceCount >= 1
            && bytecode.rootCommonReferenceCount === 0
            && bytecode.rootServerReferenceCount === 0
            && bytecode.deepServerReferenceCount === 0
            && bytecode.deepCommonReferenceCount <= 1;
        const hasStrongCommonRoots = bytecode.rootClientReferenceCount === 0
            && (bytecode.rootCommonReferenceCount >= 2 || bytecode.rootServerReferenceCount >= 1);

        if (hasStrongClientRoots) {
            const roleType = determineClientRole(categories);

            return {
                decision: ENGINE_DECISIONS.remove,
                confidence: bytecode.rootClientReferenceCount >= 3 ? CONFIDENCE_LEVELS.high : CONFIDENCE_LEVELS.medium,
                reason: 'Bytecode reachability found client namespaces in root initialization classes',
                roleType,
                roleConfidence: bytecode.rootClientReferenceCount >= 3 ? CONFIDENCE_LEVELS.high : CONFIDENCE_LEVELS.medium,
                roleReason: 'Root classes reference client-only namespaces',
                evidence
            };
        }

        if (hasStrongCommonRoots) {
            const roleType = determineCommonRole(categories);
            const confidence = bytecode.deepClientReferenceCount === 0 ? CONFIDENCE_LEVELS.high : CONFIDENCE_LEVELS.medium;

            return {
                decision: ENGINE_DECISIONS.keep,
                confidence,
                reason: 'Bytecode reachability found only common/server namespaces in root classes',
                roleType,
                roleConfidence: confidence,
                roleReason: 'Root classes stay on the common/server side',
                evidence
            };
        }

        if (hasMixedRootSignals) {
            return {
                decision: ENGINE_DECISIONS.unknown,
                confidence: CONFIDENCE_LEVELS.low,
                reason: 'Bytecode reachability found mixed client and common root references',
                roleType: categories.has('compat') ? 'compat-client' : 'unknown',
                roleConfidence: CONFIDENCE_LEVELS.low,
                roleReason: 'Root classes reference both client and common namespaces',
                evidence
            };
        }

        if (hasLikelyClientRoots) {
            const roleType = determineClientRole(categories);

            return {
                decision: ENGINE_DECISIONS.remove,
                confidence: CONFIDENCE_LEVELS.medium,
                reason: 'Bytecode reachability found likely client-only root references',
                roleType,
                roleConfidence: CONFIDENCE_LEVELS.medium,
                roleReason: 'Root classes lean toward client-only namespaces',
                evidence
            };
        }

        if (
            bytecode.rootClientReferenceCount === 0
            && bytecode.deepClientReferenceCount > 0
            && (bytecode.rootCommonReferenceCount > 0 || bytecode.rootServerReferenceCount > 0)
        ) {
            const roleType = determineCommonRole(categories);

            return {
                decision: ENGINE_DECISIONS.keep,
                confidence: CONFIDENCE_LEVELS.medium,
                reason: 'Bytecode reachability found client references only outside root classes',
                roleType,
                roleConfidence: CONFIDENCE_LEVELS.medium,
                roleReason: 'Client references appear only in non-root classes',
                evidence
            };
        }

        if (bytecode.rootClientReferenceCount > 0 || bytecode.rootCommonReferenceCount > 0 || bytecode.rootServerReferenceCount > 0) {
            const roleType = bytecode.rootClientReferenceCount > 0
                ? determineClientRole(categories)
                : determineCommonRole(categories);

            return {
                decision: ENGINE_DECISIONS.unknown,
                confidence: CONFIDENCE_LEVELS.low,
                reason: 'Bytecode reachability found root references, but they are not decisive yet',
                roleType,
                roleConfidence: CONFIDENCE_LEVELS.low,
                roleReason: 'Partial root-class evidence was collected',
                evidence
            };
        }

        return {
            decision: ENGINE_DECISIONS.unknown,
            confidence: CONFIDENCE_LEVELS.none,
            reason: 'Bytecode reachability did not find useful root-class signals',
            roleType: 'unknown',
            roleConfidence: CONFIDENCE_LEVELS.none,
            roleReason: null
        };
    }
};

module.exports = {
    forgeBytecodeEngine
};
