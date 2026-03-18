import type { ArbiterSummary } from './arbiter';
import type { ClassificationSnapshot } from './classification';
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
    reason: string;
    decisionOrigin: string | null;
    requiresReview: boolean;
    finalSemanticDecision: string | null;
    finalConfidence: string | null;
}

export interface RunReport {
    run: RunContext & {
        enabledEngines?: string[];
        registrySource?: string;
        registryVersion?: string;
        registryFilePath?: string | null;
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
    classification: {
        finalDecisions: {
            keep: number;
            remove: number;
        };
        conflicts: number;
        fallbackFinalDecisions: number;
        filesWithEngineErrors: number;
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
    decisions?: ReportDecisionSummary[];
    warnings: ReportIssue[];
    errors: ReportIssue[];
    events: ReportEvent[];
}
