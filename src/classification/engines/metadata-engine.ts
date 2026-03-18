const { DECLARED_SIDES } = require('../../metadata/constants');
const { CONFIDENCE_LEVELS, ENGINE_DECISIONS } = require('../constants');

import type { ClassificationEngine, EngineEvidence } from '../../types/classification';
import type { ModDescriptor } from '../../types/descriptor';

const CLIENT_ENTRYPOINT_HINTS = ['client', 'client_init', 'client-init', 'clientinit'];

function hasClientEntrypoint(descriptor: ModDescriptor): boolean {
    return descriptor.entrypoints.some((entrypoint) => CLIENT_ENTRYPOINT_HINTS.includes(String(entrypoint.key || '').toLowerCase()));
}

function buildMetadataEvidence(descriptor: ModDescriptor, extra: EngineEvidence[] = []): EngineEvidence[] {
    return [
        ...descriptor.metadataFilesFound.map((metadataFile) => ({
            type: 'metadata-file',
            value: metadataFile,
            source: 'stage-2-parser'
        })),
        ...extra
    ];
}

const metadataEngine: ClassificationEngine = {
    name: 'metadata-engine',
    classify({ descriptor }) {
        if (descriptor.parsingErrors.some((item) => item.fatal)) {
            return {
                decision: ENGINE_DECISIONS.unknown,
                confidence: CONFIDENCE_LEVELS.none,
                reason: 'Primary metadata could not be parsed safely',
                warnings: ['Falling back to other engines because metadata parsing failed'],
                evidence: descriptor.parsingErrors.map((item) => ({
                    type: 'parsing-error',
                    value: `${item.code}: ${item.message}`,
                    source: item.source
                }))
            };
        }

        if (descriptor.declaredSide === DECLARED_SIDES.client) {
            return {
                decision: ENGINE_DECISIONS.remove,
                confidence: CONFIDENCE_LEVELS.high,
                reason: 'Metadata explicitly marks the mod as client-side',
                evidence: buildMetadataEvidence(descriptor, [
                    {
                        type: 'declared-side',
                        value: descriptor.declaredSide,
                        source: 'normalized-descriptor'
                    }
                ])
            };
        }

        if (descriptor.declaredSide === DECLARED_SIDES.server) {
            return {
                decision: ENGINE_DECISIONS.keep,
                confidence: CONFIDENCE_LEVELS.high,
                reason: 'Metadata explicitly marks the mod as server-side',
                evidence: buildMetadataEvidence(descriptor, [
                    {
                        type: 'declared-side',
                        value: descriptor.declaredSide,
                        source: 'normalized-descriptor'
                    }
                ])
            };
        }

        if (descriptor.declaredSide === DECLARED_SIDES.both) {
            return {
                decision: ENGINE_DECISIONS.keep,
                confidence: CONFIDENCE_LEVELS.high,
                reason: 'Metadata explicitly marks the mod as compatible with both sides',
                evidence: buildMetadataEvidence(descriptor, [
                    {
                        type: 'declared-side',
                        value: descriptor.declaredSide,
                        source: 'normalized-descriptor'
                    }
                ])
            };
        }

        if (hasClientEntrypoint(descriptor)) {
            return {
                decision: ENGINE_DECISIONS.remove,
                confidence: CONFIDENCE_LEVELS.medium,
                reason: 'Client-only entrypoints were found in metadata',
                evidence: buildMetadataEvidence(
                    descriptor,
                    descriptor.entrypoints
                        .filter((entrypoint) => CLIENT_ENTRYPOINT_HINTS.includes(String(entrypoint.key || '').toLowerCase()))
                        .map((entrypoint) => ({
                            type: 'entrypoint',
                            value: `${entrypoint.key}:${entrypoint.value}`,
                            source: entrypoint.loaderOrigin
                        }))
                )
            };
        }

        if (descriptor.metadataFilesFound.length === 0) {
            return {
                decision: ENGINE_DECISIONS.unknown,
                confidence: CONFIDENCE_LEVELS.none,
                reason: 'No supported metadata files were found'
            };
        }

        return {
            decision: ENGINE_DECISIONS.unknown,
            confidence: CONFIDENCE_LEVELS.low,
            reason: 'Metadata was found, but it does not contain an explicit side decision',
            evidence: buildMetadataEvidence(descriptor)
        };
    }
};

module.exports = {
    metadataEngine
};
