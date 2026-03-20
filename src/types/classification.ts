import type { ModDescriptor } from './descriptor';
import type { EffectiveRegistry, RegistryRule } from './registry';
import type { RunContext } from './run';

export type EngineName =
    | 'probe-knowledge-engine'
    | 'metadata-engine'
    | 'forge-bytecode-engine'
    | 'client-signature-engine'
    | 'forge-semantic-engine'
    | 'dependency-role-engine'
    | 'registry-engine'
    | 'filename-engine'
    | string;
export type EngineDecision = 'keep' | 'remove' | 'unknown' | 'error';
export type SemanticDecision = 'keep' | 'remove' | 'review' | 'unknown';
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'none';
export type RoleType =
    | 'client-ui'
    | 'client-visual'
    | 'client-qol'
    | 'client-library'
    | 'common-library'
    | 'common-gameplay'
    | 'common-optimization'
    | 'compat-client'
    | 'unknown';

export interface EngineEvidence {
    type: string;
    value: string;
    source?: string | null;
}

export interface EngineError {
    code: string;
    message: string;
}

export interface EngineResult {
    engine: EngineName;
    decision: EngineDecision;
    confidence: ConfidenceLevel;
    reason: string;
    evidence: EngineEvidence[];
    warnings: string[];
    error: EngineError | null;
    matchedRule: string | null;
    matchedRuleSource: string | null;
    roleType: RoleType;
    roleConfidence: ConfidenceLevel;
    roleReason: string | null;
}

export interface RoleSignal {
    engine: EngineName;
    roleType: RoleType;
    confidence: ConfidenceLevel;
    reason: string;
}

export interface ClassificationConflict {
    hasConflict: boolean;
    keepEngines: string[];
    removeEngines: string[];
}

export interface FinalClassification {
    finalDecision: 'keep' | 'remove';
    confidence: ConfidenceLevel;
    reason: string;
    winningEngine: string | null;
    matchedRule: string | null;
    matchedRuleSource: string | null;
    finalRoleType: RoleType;
    roleConfidence: ConfidenceLevel;
    roleReason: string | null;
    roleOrigin: string | null;
    roleSignals: RoleSignal[];
    usedFallback: boolean;
    conflict: ClassificationConflict;
    results: EngineResult[];
}

export interface ClassificationEngine {
    name: EngineName;
    classify(input: {
        descriptor: ModDescriptor;
        runContext?: RunContext | null;
        classificationContext: ClassificationContext;
    }): Partial<EngineResult> | null | undefined;
}

export interface ClassificationContext {
    blockList: string[];
    localRegistry: EffectiveRegistry;
    probeKnowledge?: {
        filePath?: string | null;
        entries?: unknown[];
    } | null;
    availableEngines: string[];
    enabledEngines: string[];
}

export interface ClassificationStats {
    enabledEngines: string[];
    finalDecisions: {
        keep: number;
        remove: number;
    };
    conflicts: number;
    fallbackFinalDecisions: number;
    filesWithEngineErrors: number;
    roleTypes: Record<RoleType, number>;
    byEngine: Record<string, {
        keep: number;
        remove: number;
        unknown: number;
        error: number;
    }>;
}

export type ClassificationSnapshot = FinalClassification;

export interface ScoredRegistryRule {
    rule: RegistryRule;
    score: number;
}

export interface PickedRegistryRule {
    bestRule: RegistryRule | null;
    matchedCount: number;
}
