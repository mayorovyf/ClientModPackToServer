const { LOADER_TYPES } = require('../../metadata/constants');
const { CONFIDENCE_LEVELS, ENGINE_DECISIONS } = require('../constants');

import type { ClassificationEngine, ConfidenceLevel, EngineEvidence, RoleType } from '../../types/classification';
import type { ArchiveHintCategory, ClientSignatureIndex, ModDescriptor } from '../../types/descriptor';

function isForgeLike(descriptor: ModDescriptor): boolean {
    return descriptor.loader === LOADER_TYPES.forge || descriptor.loader === LOADER_TYPES.neoforge;
}

function collectCategories(descriptor: ModDescriptor): Set<ArchiveHintCategory> {
    return new Set(descriptor.archiveIndex?.hintCategories || []);
}

function collectSignatureKinds(index: ClientSignatureIndex | null | undefined): Set<string> {
    return new Set((index?.signatureKinds || []).map((value) => String(value || '').trim().toLowerCase()).filter(Boolean));
}

function determineClientRole(signatureKinds: Set<string>, categories: Set<ArchiveHintCategory>): RoleType {
    if (signatureKinds.has('service-client-adapter') && (categories.has('compat') || categories.has('library'))) {
        return categories.has('compat') ? 'compat-client' : 'client-library';
    }

    if (signatureKinds.has('gui-api') || signatureKinds.has('input-api') || signatureKinds.has('forge-client-event')) {
        return 'client-ui';
    }

    if (signatureKinds.has('render-api') || signatureKinds.has('mixin-client-target') || categories.has('visual')) {
        return 'client-visual';
    }

    if (categories.has('library')) {
        return 'client-library';
    }

    return 'client-qol';
}

function buildEvidence(descriptor: ModDescriptor, index: ClientSignatureIndex): EngineEvidence[] {
    const bytecode = descriptor.archiveIndex?.bytecode;

    return [
        {
            type: 'signature-kinds',
            value: index.signatureKinds.join(', ') || 'n/a',
            source: 'client-signature-index'
        },
        {
            type: 'signature-counts',
            value: `extends=${index.clientApiExtendsCount}, implements=${index.clientApiImplementsCount}, method=${index.clientMethodSignatureCount}, field=${index.clientFieldSignatureCount}, client-events=${index.forgeClientEventHitCount}, services=${index.serviceClientAdapterCount}, mixins=${index.mixinClientTargetCount}, bootstrap=${index.clientBootstrapPatternCount}`,
            source: 'client-signature-index'
        },
        ...index.evidenceSamples.slice(0, 4).map((value) => ({
            type: 'signature-evidence',
            value,
            source: 'client-signature-index'
        })),
        ...((bytecode?.rootClientReferenceSamples || []).slice(0, 2).map((value) => ({
            type: 'bytecode-root-client',
            value,
            source: 'archive-index'
        }))),
        ...((bytecode?.rootCommonReferenceSamples || []).slice(0, 1).map((value) => ({
            type: 'bytecode-root-common',
            value,
            source: 'archive-index'
        })))
    ];
}

function countTrue(values: boolean[]): number {
    return values.filter(Boolean).length;
}

function determineConfidence({
    hasStrongClientRoots,
    rootApiSignalCount,
    compositeCount,
    eventCount,
    serviceCount
}: {
    hasStrongClientRoots: boolean;
    rootApiSignalCount: number;
    compositeCount: number;
    eventCount: number;
    serviceCount: number;
}): ConfidenceLevel {
    if (hasStrongClientRoots && (rootApiSignalCount >= 2 || compositeCount >= 2 || eventCount > 0)) {
        return CONFIDENCE_LEVELS.high;
    }

    if (hasStrongClientRoots || compositeCount >= 1 || serviceCount > 0) {
        return CONFIDENCE_LEVELS.medium;
    }

    return CONFIDENCE_LEVELS.low;
}

function isDirectClientRole(roleType: RoleType): boolean {
    return roleType === 'client-ui' || roleType === 'client-qol';
}

const clientSignatureEngine: ClassificationEngine = {
    name: 'client-signature-engine',
    classify({ descriptor }) {
        if (!isForgeLike(descriptor)) {
            return {
                decision: ENGINE_DECISIONS.unknown,
                confidence: CONFIDENCE_LEVELS.none,
                reason: 'Client signature analysis only applies to Forge and NeoForge jars'
            };
        }

        const index = descriptor.archiveIndex?.clientSignatures;

        if (!index) {
            return {
                decision: ENGINE_DECISIONS.unknown,
                confidence: CONFIDENCE_LEVELS.none,
                reason: 'Client signature analysis did not collect any signature data'
            };
        }

        const bytecode = descriptor.archiveIndex?.bytecode;
        const categories = collectCategories(descriptor);
        const signatureKinds = collectSignatureKinds(index);
        const evidence = buildEvidence(descriptor, index);
        const rootApiSignalCount = index.clientApiExtendsCount
            + index.clientApiImplementsCount
            + index.clientMethodSignatureCount
            + index.clientFieldSignatureCount;
        const hasStrongClientRoots = Boolean(
            bytecode
            && bytecode.rootClientReferenceCount > 0
            && bytecode.rootCommonReferenceCount === 0
            && bytecode.rootServerReferenceCount === 0
        );
        const hasMixedRoots = Boolean(
            bytecode
            && bytecode.rootClientReferenceCount > 0
            && (bytecode.rootCommonReferenceCount > 0 || bytecode.rootServerReferenceCount > 0)
        );
        const hasCommonRootsOnly = Boolean(
            bytecode
            && bytecode.rootClientReferenceCount === 0
            && (bytecode.rootCommonReferenceCount > 0 || bytecode.rootServerReferenceCount > 0)
        );

        const hasGuiFamily = signatureKinds.has('gui-api') || signatureKinds.has('input-api');
        const hasInputFamily = signatureKinds.has('input-api');
        const hasRenderFamily = signatureKinds.has('render-api');
        const hasAudioFamily = signatureKinds.has('audio-api');
        const hasEventFamily = signatureKinds.has('forge-client-event');
        const hasServiceFamily = signatureKinds.has('service-client-adapter');
        const hasMixinFamily = signatureKinds.has('mixin-client-target');
        const hasBootstrapFamily = signatureKinds.has('client-bootstrap-pattern');

        const strongGuiProfile = hasGuiFamily && (hasEventFamily || hasBootstrapFamily || rootApiSignalCount >= 2);
        const strongRenderProfile = hasRenderFamily && (hasMixinFamily || hasEventFamily || rootApiSignalCount >= 2);
        const strongAudioProfile = hasAudioFamily && (hasEventFamily || hasBootstrapFamily || rootApiSignalCount >= 2);
        const strongCompatProfile = hasServiceFamily && (hasBootstrapFamily || hasEventFamily || categories.has('compat') || categories.has('library'));
        const compositeCount = countTrue([strongGuiProfile, strongRenderProfile, strongAudioProfile, strongCompatProfile]);
        const familyCount = countTrue([
            hasGuiFamily,
            hasRenderFamily,
            hasAudioFamily,
            hasEventFamily,
            hasServiceFamily,
            hasMixinFamily,
            hasBootstrapFamily
        ]);
        const roleType = determineClientRole(signatureKinds, categories);
        const confidence = determineConfidence({
            hasStrongClientRoots,
            rootApiSignalCount,
            compositeCount,
            eventCount: index.forgeClientEventHitCount,
            serviceCount: index.serviceClientAdapterCount
        });
        const strongUiProfileScore = countTrue([
            hasGuiFamily,
            hasInputFamily,
            hasEventFamily,
            rootApiSignalCount >= 4,
            index.mixinClientTargetCount >= 8,
            index.clientBootstrapPatternCount >= 4
        ]);
        const canEscalateMixedUiProfile = isDirectClientRole(roleType)
            && !categories.has('library')
            && rootApiSignalCount > 0
            && (bytecode?.rootClientReferenceCount || 0) >= 2
            && (bytecode?.rootCommonReferenceCount || 0) <= ((bytecode?.rootClientReferenceCount || 0) * 3) + 2
            && (bytecode?.rootServerReferenceCount || 0) <= 3
            && strongUiProfileScore >= 3;

        if (hasCommonRootsOnly && rootApiSignalCount === 0 && index.forgeClientEventHitCount === 0 && index.serviceClientAdapterCount === 0) {
            return {
                decision: ENGINE_DECISIONS.unknown,
                confidence: CONFIDENCE_LEVELS.none,
                reason: 'Root classes stay on the common/server side and client signatures are absent',
                roleType: 'unknown',
                roleConfidence: CONFIDENCE_LEVELS.none,
                roleReason: null,
                evidence
            };
        }

        if (canEscalateMixedUiProfile) {
            return {
                decision: ENGINE_DECISIONS.remove,
                confidence: CONFIDENCE_LEVELS.high,
                reason: 'Client signature analysis found a strong client UI/profile even though some common roots remain',
                roleType,
                roleConfidence: CONFIDENCE_LEVELS.high,
                roleReason: 'GUI/input hooks and client bootstrap code dominate the mixed root profile',
                evidence
            };
        }

        if (hasMixedRoots && compositeCount === 0 && rootApiSignalCount < 2) {
            return {
                decision: ENGINE_DECISIONS.unknown,
                confidence: CONFIDENCE_LEVELS.low,
                reason: 'Client signatures were found, but root bytecode remains mixed between client and common paths',
                roleType: categories.has('compat') ? 'compat-client' : 'unknown',
                roleConfidence: CONFIDENCE_LEVELS.low,
                roleReason: 'Mixed root namespaces make the client profile unsafe to apply automatically',
                evidence
            };
        }

        if (
            (hasStrongClientRoots && compositeCount >= 1)
            || (!hasMixedRoots && rootApiSignalCount >= 2 && compositeCount >= 1)
            || (!hasMixedRoots && familyCount >= 3 && (index.forgeClientEventHitCount > 0 || index.mixinClientTargetCount > 0))
        ) {
            return {
                decision: ENGINE_DECISIONS.remove,
                confidence,
                reason: 'Client signature analysis found a strong client-only integration profile',
                roleType,
                roleConfidence: confidence,
                roleReason: 'Root API signatures, client hooks, and bootstrap patterns indicate a client-only mod',
                evidence
            };
        }

        if (hasServiceFamily && hasStrongClientRoots && (categories.has('compat') || categories.has('library'))) {
            return {
                decision: ENGINE_DECISIONS.remove,
                confidence: CONFIDENCE_LEVELS.medium,
                reason: 'Client platform service wiring is rooted in client-only classes',
                roleType,
                roleConfidence: CONFIDENCE_LEVELS.medium,
                roleReason: 'Client service adapters are wired from client-only roots',
                evidence
            };
        }

        if (familyCount > 0 || rootApiSignalCount > 0) {
            return {
                decision: ENGINE_DECISIONS.unknown,
                confidence: CONFIDENCE_LEVELS.low,
                reason: 'Client signature analysis collected partial evidence, but not enough for an automatic decision',
                roleType,
                roleConfidence: CONFIDENCE_LEVELS.low,
                roleReason: 'Client-oriented signatures were detected, but the profile is still incomplete',
                evidence
            };
        }

        return {
            decision: ENGINE_DECISIONS.unknown,
            confidence: CONFIDENCE_LEVELS.none,
            reason: 'Client signature analysis did not find actionable client integration signals',
            roleType: 'unknown',
            roleConfidence: CONFIDENCE_LEVELS.none,
            roleReason: null
        };
    }
};

module.exports = {
    clientSignatureEngine
};
