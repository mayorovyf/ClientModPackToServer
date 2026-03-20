const { getEntrypointKind } = require('../validation/entrypoint-resolver');
const {
    SUPPORTED_LAYOUT_INPUT_KINDS,
    SUPPORTED_LAYOUT_SOURCES,
    SUPPORTED_LOADERS,
    SUPPORTED_VALIDATION_ENTRYPOINT_KINDS,
    SUPPORTED_MANAGED_SERVER_ENTRYPOINT_KINDS,
    SUPPORTED_SERVER_CORE_TYPES
} = require('./constants');

import type { ValidationEntrypoint } from '../types/validation';
import type { SupportBoundaryAssessment, SupportBoundaryFacetStatus } from '../types/policy';
import type { RunContext } from '../types/run';

function toSortedUniqueList(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function deriveAssessmentStatus(checkStatuses: SupportBoundaryFacetStatus[]): 'supported' | 'unsupported' {
    return checkStatuses.includes('unsupported') ? 'unsupported' : 'supported';
}

function buildAssessmentSummary({
    status,
    isFinal,
    hasPendingChecks
}: {
    status: 'supported' | 'unsupported';
    isFinal: boolean;
    hasPendingChecks: boolean;
}): string {
    if (status === 'unsupported') {
        return 'Scenario is outside the Tier A support boundary.';
    }

    if (hasPendingChecks) {
        return isFinal
            ? 'Scenario remains inside the Tier A support boundary based on resolved checks, but some checks are still pending.'
            : 'Scenario is inside the Tier A support boundary so far, but some checks require later analysis.';
    }

    return 'Scenario is inside the Tier A support boundary.';
}

function buildLayoutCheck(runContext: RunContext): SupportBoundaryAssessment['layout'] {
    const supported = SUPPORTED_LAYOUT_INPUT_KINDS.includes(runContext.inputKind)
        && SUPPORTED_LAYOUT_SOURCES.includes(runContext.instanceSource);

    return {
        status: supported ? 'supported' : 'unsupported',
        code: supported ? 'LAYOUT_SUPPORTED' : 'LAYOUT_UNSUPPORTED',
        summary: supported
            ? `Input layout ${runContext.instanceSource} is inside the Tier A whitelist.`
            : `Input layout ${runContext.instanceSource} is outside the Tier A whitelist.`,
        inputKind: runContext.inputKind,
        instanceSource: runContext.instanceSource,
        supportedInputKinds: [...SUPPORTED_LAYOUT_INPUT_KINDS],
        supportedInstanceSources: [...SUPPORTED_LAYOUT_SOURCES]
    };
}

function buildLoaderProfileCheck({
    decisions,
    isFinal
}: {
    decisions?: Array<Record<string, any>> | null;
    isFinal: boolean;
}): SupportBoundaryAssessment['loaderProfile'] {
    if (!Array.isArray(decisions)) {
        return {
            status: 'pending',
            code: 'LOADER_PROFILE_PENDING',
            summary: 'Loader profile will be resolved after static analysis.',
            profile: 'unresolved',
            detectedLoaders: [],
            supportedLoaders: [...SUPPORTED_LOADERS]
        };
    }

    const detectedLoaders = toSortedUniqueList(decisions
        .map((decision) => decision?.descriptor?.loader)
        .filter((loader) => typeof loader === 'string' && loader !== 'unknown')) as SupportBoundaryAssessment['loaderProfile']['detectedLoaders'];

    if (detectedLoaders.length === 0) {
        return {
            status: isFinal ? 'unsupported' : 'pending',
            code: isFinal ? 'LOADER_PROFILE_UNRESOLVED' : 'LOADER_PROFILE_PENDING',
            summary: isFinal
                ? 'Static analysis could not determine a supported single-loader profile.'
                : 'Loader profile has not been resolved yet.',
            profile: 'unresolved',
            detectedLoaders,
            supportedLoaders: [...SUPPORTED_LOADERS]
        };
    }

    if (detectedLoaders.length > 1) {
        return {
            status: 'unsupported',
            code: 'HYBRID_LOADER_PACK',
            summary: `Detected multiple loaders: ${detectedLoaders.join(', ')}.`,
            profile: 'hybrid-loader',
            detectedLoaders,
            supportedLoaders: [...SUPPORTED_LOADERS]
        };
    }

    const [loader] = detectedLoaders;
    const supported = SUPPORTED_LOADERS.includes(loader);

    return {
        status: supported ? 'supported' : 'unsupported',
        code: supported ? 'SINGLE_LOADER_SUPPORTED' : 'LOADER_UNSUPPORTED',
        summary: supported
            ? `Detected single-loader pack: ${loader}.`
            : `Detected loader ${loader}, which is outside the Tier A whitelist.`,
        profile: 'single-loader',
        detectedLoaders,
        supportedLoaders: [...SUPPORTED_LOADERS]
    };
}

function buildValidationEntrypointCheck({
    runContext,
    validationEntrypoint
}: {
    runContext: RunContext;
    validationEntrypoint?: ValidationEntrypoint | null;
}): SupportBoundaryAssessment['validationEntrypoint'] {
    const explicitPath = runContext.validationEntrypointPath || null;

    if (validationEntrypoint?.kind) {
        const supported = SUPPORTED_VALIDATION_ENTRYPOINT_KINDS.includes(validationEntrypoint.kind);

        return {
            status: supported ? 'supported' : 'unsupported',
            code: supported ? 'VALIDATION_ENTRYPOINT_SUPPORTED' : 'VALIDATION_ENTRYPOINT_UNSUPPORTED',
            summary: supported
                ? `Validation entrypoint kind ${validationEntrypoint.kind} is inside the Tier A whitelist.`
                : `Validation entrypoint kind ${validationEntrypoint.kind} is outside the Tier A whitelist.`,
            mode: validationEntrypoint.source,
            requestedPath: validationEntrypoint.originalPath || explicitPath,
            resolvedKind: validationEntrypoint.kind,
            supportedKinds: [...SUPPORTED_VALIDATION_ENTRYPOINT_KINDS]
        };
    }

    if (explicitPath) {
        const explicitKind = getEntrypointKind(explicitPath);
        const supported = explicitKind ? SUPPORTED_VALIDATION_ENTRYPOINT_KINDS.includes(explicitKind) : false;

        return {
            status: supported ? 'supported' : 'unsupported',
            code: supported ? 'VALIDATION_ENTRYPOINT_SUPPORTED' : 'VALIDATION_ENTRYPOINT_UNSUPPORTED',
            summary: supported
                ? `Explicit validation entrypoint kind ${explicitKind} is inside the Tier A whitelist.`
                : `Explicit validation entrypoint ${explicitPath} does not map to a whitelist-supported validation entrypoint kind.`,
            mode: 'explicit',
            requestedPath: explicitPath,
            resolvedKind: explicitKind,
            supportedKinds: [...SUPPORTED_VALIDATION_ENTRYPOINT_KINDS]
        };
    }

    return {
        status: 'pending',
        code: 'VALIDATION_ENTRYPOINT_PENDING',
        summary: 'Validation entrypoint will be resolved later by auto-detection or explicit configuration.',
        mode: 'auto',
        requestedPath: null,
        resolvedKind: null,
        supportedKinds: [...SUPPORTED_VALIDATION_ENTRYPOINT_KINDS]
    };
}

function buildManagedServerCheck(): SupportBoundaryAssessment['managedServer'] {
    return {
        status: 'supported',
        code: 'MANAGED_SERVER_WHITELIST_READY',
        summary: 'Managed server operations are restricted to the current whitelist of core and entrypoint kinds.',
        supportedCoreTypes: [...SUPPORTED_SERVER_CORE_TYPES],
        supportedEntrypointKinds: [...SUPPORTED_MANAGED_SERVER_ENTRYPOINT_KINDS]
    };
}

function collectReasons(checks: Array<{ status: SupportBoundaryFacetStatus; summary: string }>): string[] {
    return checks
        .filter((check) => check.status === 'unsupported' || check.status === 'pending')
        .map((check) => check.summary);
}

function collectPendingCheckCodes(checks: Array<{ status: SupportBoundaryFacetStatus; code: string }>): string[] {
    return checks
        .filter((check) => check.status === 'pending')
        .map((check) => check.code);
}

function assessSupportBoundary({
    runContext,
    decisions = null,
    validationEntrypoint = null,
    isFinal = false
}: {
    runContext: RunContext;
    decisions?: Array<Record<string, any>> | null;
    validationEntrypoint?: ValidationEntrypoint | null;
    isFinal?: boolean;
}): SupportBoundaryAssessment {
    const layout = buildLayoutCheck(runContext);
    const loaderProfile = buildLoaderProfileCheck({
        decisions,
        isFinal
    });
    const validationEntrypointCheck = buildValidationEntrypointCheck({
        runContext,
        validationEntrypoint
    });
    const managedServer = buildManagedServerCheck();
    const checks = [layout, loaderProfile, validationEntrypointCheck, managedServer];
    const pendingCheckCodes = collectPendingCheckCodes(checks);
    const hasPendingChecks = pendingCheckCodes.length > 0;
    const status = deriveAssessmentStatus(checks.map((check) => check.status));

    return {
        tier: 'tier-a',
        status,
        isFinal,
        hasPendingChecks,
        summary: buildAssessmentSummary({
            status,
            isFinal,
            hasPendingChecks
        }),
        reasons: collectReasons(checks),
        pendingCheckCodes,
        layout,
        loaderProfile,
        validationEntrypoint: validationEntrypointCheck,
        managedServer
    };
}

module.exports = {
    assessSupportBoundary
};
