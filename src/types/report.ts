import type { ArbiterSummary } from './arbiter';
import type { ArchiveIndex } from './descriptor';
import type { ClassificationSnapshot, ClassificationStats, RoleSignal, RoleType } from './classification';
import type { DeepCheckResult } from './deep-check';
import type { DependencyGraphSummary } from './dependency';
import type { RegistryRuntimeState } from './registry';
import type { RunContext } from './run';
import type { ValidationResult } from './validation';

export interface ReportIssue {
    fileName: string | null;
    source: string;
    code: string;
    message: string;
    fatal?: boolean;
}

export interface ReportEvent {
    timestamp: string;
    level: string;
    kind: string;
    message: string;
}

export interface ReportDecisionSummary {
    fileName: string;
    displayName?: string | null;
    modIds?: string[];
    reason: string;
    decision?: 'keep' | 'exclude' | null;
    decisionOrigin: string | null;
    arbiterDecision?: string | null;
    arbiterConfidence?: string | null;
    requiresReview: boolean;
    finalSemanticDecision: string | null;
    finalConfidence: string | null;
    finalDecisionOrigin?: string | null;
    finalRoleType?: RoleType | null;
    roleConfidence?: string | null;
    roleOrigin?: string | null;
    roleReason?: string | null;
    roleSignals?: RoleSignal[];
    deepCheckStatus?: string | null;
    deepCheckDecision?: string | null;
    actionStatus?: string | null;
    dependencyAdjusted?: boolean;
    finalReasons?: string[];
    manualReviewKey?: string | null;
    manualOverrideAction?: 'keep' | 'exclude' | null;
    manualOverrideReason?: string | null;
    manualOverrideUpdatedAt?: string | null;
    descriptor?: {
        fileName?: string;
        loader?: string;
        modIds?: string[];
        displayName?: string | null;
        version?: string | null;
        manifestHints?: Record<string, string> | null;
        archiveIndex?: ArchiveIndex | null;
    } | null;
}

export interface RunReport {
    run: RunContext & {
        enabledEngines?: string[];
        registrySource?: string;
        registryVersion?: string;
        registryFilePath?: string | null;
        reviewOverridesPath?: string | null;
    };
    stats: {
        totalJarFiles: number;
        kept: number;
        excluded: number;
        copied: number;
        wouldCopy: number;
        wouldExclude: number;
        errors: number;
    };
    parsing: {
        loaders: Record<string, number>;
        filesWithWarnings: number;
        filesWithErrors: number;
    };
    classification: ClassificationStats & {
        snapshots?: ClassificationSnapshot[];
    };
    dependencyGraph?: {
        status: string;
        summary: DependencyGraphSummary;
    };
    arbiter?: {
        status: string;
        summary: ArbiterSummary;
    };
    deepCheck?: {
        status: string;
        summary: {
            triggered: number;
            skipped: number;
            resolved: number;
            unresolved: number;
            failed: number;
            decisionChanged: number;
        };
        results?: DeepCheckResult[];
    };
    validation?: ValidationResult;
    registry?: RegistryRuntimeState;
    manualReview?: {
        overridesPath: string | null;
        totalEntries: number;
        appliedOverrides: number;
        kept: number;
        excluded: number;
    };
    decisions?: ReportDecisionSummary[];
    warnings: ReportIssue[];
    errors: ReportIssue[];
    events: ReportEvent[];
}
