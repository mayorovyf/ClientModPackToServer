import type { InstanceInputKind, InstanceSource } from './intake';
import type { ValidationEntrypointKind } from './validation';
import type { ManagedServerEntrypointKind, ServerCoreType } from '../server/types';
import type { RuntimeTopologyAssessment } from './topology';

export type SupportBoundaryFacetStatus = 'supported' | 'unsupported' | 'pending';
export type SupportBoundaryStatus = 'supported' | 'unsupported';
export type SupportBoundaryTier = 'tier-a';
export type TrustPolicyDisposition = 'safe-by-default' | 'guarded' | 'manual-only' | 'forbidden';
export type TrustPolicyAction =
    | 'accept-eula'
    | 'select-java-profile'
    | 'add-trusted-dependency'
    | 'remove-explicit-client-only-mod'
    | 'remove-confirmed-client-only-support-library'
    | 'switch-whitelisted-server-core'
    | 'switch-whitelisted-entrypoint'
    | 'retry-timeout'
    | 'mass-remove-suspects'
    | 'patch-third-party-jar'
    | 'mutate-source-instance'
    | 'download-untrusted-artifact'
    | 'run-untrusted-installer'
    | 'connector-specific-risky-fix';

export interface SupportBoundaryLayoutCheck {
    status: SupportBoundaryFacetStatus;
    code: string;
    summary: string;
    inputKind: InstanceInputKind;
    instanceSource: InstanceSource;
    supportedInputKinds: InstanceInputKind[];
    supportedInstanceSources: InstanceSource[];
}

export interface SupportBoundaryEntrypointCheck {
    status: SupportBoundaryFacetStatus;
    code: string;
    summary: string;
    mode: 'auto' | 'explicit';
    requestedPath: string | null;
    resolvedKind: ValidationEntrypointKind | null;
    supportedKinds: ValidationEntrypointKind[];
}

export interface SupportBoundaryManagedServerCheck {
    status: SupportBoundaryFacetStatus;
    code: string;
    summary: string;
    supportedCoreTypes: ServerCoreType[];
    supportedEntrypointKinds: ManagedServerEntrypointKind[];
}

export interface SupportBoundaryAssessment {
    tier: SupportBoundaryTier;
    status: SupportBoundaryStatus;
    isFinal: boolean;
    hasPendingChecks: boolean;
    summary: string;
    reasons: string[];
    pendingCheckCodes: string[];
    layout: SupportBoundaryLayoutCheck;
    runtimeTopology: RuntimeTopologyAssessment;
    validationEntrypoint: SupportBoundaryEntrypointCheck;
    managedServer: SupportBoundaryManagedServerCheck;
}

export interface TrustPolicyActionRule {
    action: TrustPolicyAction;
    disposition: TrustPolicyDisposition;
    allowed: boolean;
    summary: string;
    requiresTrustedSource: boolean;
    supportedCoreTypes?: ServerCoreType[];
    supportedEntrypointKinds?: ValidationEntrypointKind[];
}

export interface TrustPolicyActionDecision extends TrustPolicyActionRule {
    denialReason: string | null;
    targetCoreType?: ServerCoreType | null;
    entrypointKind?: ValidationEntrypointKind | null;
    trustedSource?: boolean | null;
}

export interface TrustPolicyContract {
    version: 'v1-tier-a';
    defaultDisposition: 'forbidden';
    summary: string;
    safeByDefaultActions: TrustPolicyAction[];
    guardedActions: TrustPolicyAction[];
    manualOnlyActions: TrustPolicyAction[];
    forbiddenActions: TrustPolicyAction[];
    actions: TrustPolicyActionRule[];
}
