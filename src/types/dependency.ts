import type { DependencyKind, LoaderKind, SideHint } from './metadata';

export type DependencyFindingKind =
    | 'missing-required'
    | 'missing-optional'
    | 'provider-ambiguous'
    | 'incompatibility'
    | 'preserved-by-dependency'
    | 'orphan-library'
    | 'graph-error';

export type DependencyFindingSeverity = 'info' | 'warn' | 'error';
export type DependencyResolution = 'missing' | 'unique' | 'ambiguous' | 'self';
export type DependencyValidationMode = 'conservative' | 'report-only' | 'strict';
export type EffectiveBuildDecision = 'keep' | 'exclude' | 'unknown';

export interface DependencyProviderEntry {
    providedId: string;
    fileName: string;
    sourcePath: string;
    loader: LoaderKind;
    modIds: string[];
    provides: string[];
    currentDecision: string;
    effectiveDecision?: string;
}

export interface DependencyProviderIndex {
    byId: Record<string, DependencyProviderEntry[]>;
    providerEntries: DependencyProviderEntry[];
    summary: {
        uniqueProvidedIds: number;
        providerEntries: number;
        ambiguousIds: string[];
        ambiguousIdsCount: number;
        multiModJarCount: number;
    };
}

export interface DependencyEdge {
    fromFileName: string;
    modId: string | null;
    kind: 'required' | 'optional' | 'incompatibility';
    required: boolean;
    loaderOrigin: LoaderKind;
    versionRange: string | null;
    sideHint: SideHint | null;
    resolution: DependencyResolution;
    providerFileNames: string[];
    providers: DependencyProviderEntry[];
}

export interface DependencyIncomingEntry {
    fileName: string;
    modId: string | null;
    kind: string;
    loaderOrigin: LoaderKind;
    versionRange: string | null;
    sideHint: SideHint | null;
    decision?: string;
}

export interface DependencyNode {
    fileName: string;
    loader: LoaderKind;
    modIds: string[];
    provides: string[];
    providedIds: string[];
    initialDecision: string;
    classificationDecision: string;
    requiredEdges: DependencyEdge[];
    optionalEdges: DependencyEdge[];
    incompatibilityEdges: DependencyEdge[];
    effectiveDecision?: string;
}

export interface DependencyGraph {
    providerIndex: DependencyProviderIndex;
    nodes: DependencyNode[];
    edges: DependencyEdge[];
    incoming: {
        requiredByFile: Record<string, DependencyIncomingEntry[]>;
        optionalByFile: Record<string, DependencyIncomingEntry[]>;
        incompatibleWithFile: Record<string, DependencyIncomingEntry[]>;
    };
    summary: {
        totalNodes: number;
        totalEdges: number;
        requiredEdges: number;
        optionalEdges: number;
        incompatibilityEdges: number;
        multiModJars: number;
        providedIds: number;
        ambiguousProviderIds: number;
    };
}

export interface DependencyFinding {
    type: DependencyFindingKind;
    severity: DependencyFindingSeverity;
    fileName: string | null;
    message: string;
    modId: string | null;
    providerFileName: string | null;
    providerFileNames: string[];
    dependencyKind: string | null;
    requiredByFileName: string | null;
    loaderOrigin: LoaderKind | null;
    versionRange: string | null;
    sideHint: SideHint | null;
}

export interface DependencyGraphSummary {
    status: string;
    totalNodes: number;
    totalEdges: number;
    requiredEdges: number;
    optionalEdges: number;
    incompatibilityEdges: number;
    multiModJars: number;
    filesWithFindings: number;
    totalFindings: number;
    missingRequired: number;
    missingOptional: number;
    ambiguousProviders: number;
    incompatibilities: number;
    preservedByDependency: number;
    orphanLibraries: number;
    graphErrors: number;
}

export interface DependencyOutgoingSummaryEntry {
    modId: string | null;
    kind: string;
    resolution: DependencyResolution;
    providerFileNames: string[];
    providerDecisionStates: Array<{
        fileName: string;
        decision: string;
    }>;
    loaderOrigin: LoaderKind;
    versionRange: string | null;
    sideHint: SideHint | null;
}

export interface DependencyOutgoingSummary {
    required: DependencyOutgoingSummaryEntry[];
    optional: DependencyOutgoingSummaryEntry[];
    incompatibilities: DependencyOutgoingSummaryEntry[];
}

export interface DependencyIncomingSummary {
    requiredBy: DependencyIncomingEntry[];
    optionalBy: DependencyIncomingEntry[];
    incompatibleWith: DependencyIncomingEntry[];
}

export interface DependencyValidationUpdate {
    decision: string;
    reason: string | null;
    decisionOrigin: string | null;
    dependencyAdjusted: boolean;
    dependencyReason: string | null;
    dependencyFindings: DependencyFinding[];
    dependencyDependencies: DependencyOutgoingSummary;
    dependencyDependents: DependencyIncomingSummary;
}

export interface DependencyValidationResult {
    mode: DependencyValidationMode;
    effectiveDecisionByFile: Record<string, string>;
    findings: DependencyFinding[];
    summary: DependencyGraphSummary;
    decisionUpdatesByFile: Record<string, DependencyValidationUpdate>;
}
