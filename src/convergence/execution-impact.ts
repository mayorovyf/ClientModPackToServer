import type { AppliedFix } from './types';

export interface CandidateExecutionImpact {
    kind: 'initial-build' | 'static-reanalysis' | 'mods-delta' | 'workspace-refresh' | 'validation-only';
    requiresBaseSnapshotBuild: boolean;
    requiresSnapshotRealization: boolean;
    requiresWorkspaceMaterialization: boolean;
    requiresValidationOnly: boolean;
}

const VALIDATION_ONLY_FIXES = new Set([
    'retry-timeout',
    'select-java-profile',
    'switch-whitelisted-entrypoint'
]);

const MODS_DELTA_FIXES = new Set([
    'add-trusted-connector-dependency',
    'add-trusted-dependency',
    'remove-confirmed-client-only-support-library',
    'remove-confirmed-topology-incompatible-artifact',
    'remove-explicit-client-only-mod',
    'restore-server-required-artifact'
]);

const WORKSPACE_REFRESH_FIXES = new Set([
    'accept-eula'
]);

const STATIC_REANALYSIS_FIXES = new Set([
    'switch-whitelisted-runtime-topology'
]);

function listFixKinds(fixes: AppliedFix[]): string[] {
    return [...new Set(fixes.map((fix) => fix.kind).filter(Boolean))];
}

export function determineCandidateExecutionImpact({
    iteration,
    newlyAppliedFixes
}: {
    iteration: number;
    newlyAppliedFixes: AppliedFix[];
}): CandidateExecutionImpact {
    if (iteration === 0) {
        return {
            kind: 'initial-build',
            requiresBaseSnapshotBuild: true,
            requiresSnapshotRealization: true,
            requiresWorkspaceMaterialization: true,
            requiresValidationOnly: false
        };
    }

    const fixKinds = listFixKinds(newlyAppliedFixes);

    if (fixKinds.some((kind) => STATIC_REANALYSIS_FIXES.has(kind))) {
        return {
            kind: 'static-reanalysis',
            requiresBaseSnapshotBuild: false,
            requiresSnapshotRealization: true,
            requiresWorkspaceMaterialization: true,
            requiresValidationOnly: false
        };
    }

    if (fixKinds.some((kind) => MODS_DELTA_FIXES.has(kind) || WORKSPACE_REFRESH_FIXES.has(kind))) {
        return {
            kind: fixKinds.some((kind) => MODS_DELTA_FIXES.has(kind)) ? 'mods-delta' : 'workspace-refresh',
            requiresBaseSnapshotBuild: false,
            requiresSnapshotRealization: false,
            requiresWorkspaceMaterialization: true,
            requiresValidationOnly: false
        };
    }

    if (fixKinds.every((kind) => VALIDATION_ONLY_FIXES.has(kind))) {
        return {
            kind: 'validation-only',
            requiresBaseSnapshotBuild: false,
            requiresSnapshotRealization: false,
            requiresWorkspaceMaterialization: false,
            requiresValidationOnly: true
        };
    }

    return {
        kind: 'mods-delta',
        requiresBaseSnapshotBuild: false,
        requiresSnapshotRealization: false,
        requiresWorkspaceMaterialization: true,
        requiresValidationOnly: false
    };
}

module.exports = {
    determineCandidateExecutionImpact
};
