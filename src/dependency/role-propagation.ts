const { CONFIDENCE_LEVELS, ENGINE_DECISIONS } = require('../classification/constants');
const { createEngineResult, confidenceRank } = require('../classification/engine-result');
const { mergeClassificationResults } = require('../classification/temporary-merge-policy');
const { finalizeDecision } = require('../build/decision-model');
const { FINDING_TYPES, GRAPH_RESOLUTIONS } = require('./constants');
const { createDependencyFinding } = require('./findings');

import type { DependencyFinding, DependencyGraph } from '../types/dependency';
import type { ConfidenceLevel, FinalClassification, RoleSignal, RoleType } from '../types/classification';

const DEPENDENCY_ROLE_ENGINE = 'dependency-role-engine';
const CLIENT_ROLE_TYPES = new Set(['client-ui', 'client-visual', 'client-qol', 'client-library', 'compat-client']);
const COMMON_ROLE_TYPES = new Set(['common-library', 'common-gameplay', 'common-optimization']);

type Family = 'client' | 'common' | 'unknown';

interface PropagationSummary {
    rolePropagations: number;
    roleKeepConstraints: number;
    roleRemoveSignals: number;
}

interface PropagationResult {
    decisions: Array<Record<string, any>>;
    initialFindingsByFile: Record<string, DependencyFinding[]>;
    summary: PropagationSummary;
}

interface PropagationSuggestion {
    kind: 'remove' | 'keep-role';
    roleType: RoleType;
    confidence: ConfidenceLevel;
    reason: string;
    evidence: Array<{
        type: string;
        value: string;
        source: string;
    }>;
    findings: DependencyFinding[];
}

function roleFamily(roleType: RoleType | null | undefined): Family {
    if (roleType && CLIENT_ROLE_TYPES.has(roleType)) {
        return 'client';
    }

    if (roleType && COMMON_ROLE_TYPES.has(roleType)) {
        return 'common';
    }

    return 'unknown';
}

function collectHintCategories(decision: Record<string, any>): Set<string> {
    return new Set(decision.descriptor?.archiveIndex?.hintCategories || []);
}

function determineClientRole(categories: Set<string>): RoleType {
    if (categories.has('ui')) {
        return 'client-ui';
    }

    if (categories.has('visual')) {
        return 'client-visual';
    }

    if (categories.has('library')) {
        return 'client-library';
    }

    if (categories.has('compat')) {
        return 'compat-client';
    }

    return 'client-qol';
}

function determineCommonRole(categories: Set<string>): RoleType {
    if (categories.has('optimization')) {
        return 'common-optimization';
    }

    if (categories.has('library')) {
        return 'common-library';
    }

    return 'common-gameplay';
}

function listSampleNames(decisions: Array<Record<string, any>>, limit = 3): string[] {
    return decisions
        .slice(0, limit)
        .map((decision) => decision.descriptor?.displayName || decision.fileName)
        .filter(Boolean);
}

function getRoleState(decision: Record<string, any>): {
    roleType: RoleType;
    roleConfidence: ConfidenceLevel;
    roleReason: string | null;
    roleFamily: Family;
} {
    const classification = decision.classification;
    const roleType = (classification?.finalRoleType || decision.finalRoleType || 'unknown') as RoleType;
    const roleConfidence = (classification?.roleConfidence || decision.roleConfidence || CONFIDENCE_LEVELS.none) as ConfidenceLevel;
    const roleReason = classification?.roleReason || decision.roleReason || null;

    return {
        roleType,
        roleConfidence,
        roleReason,
        roleFamily: roleFamily(roleType)
    };
}

function hasStrongKeepSignal(classification: FinalClassification | null | undefined): boolean {
    const results = classification?.results || [];
    return results.some((result) => result.decision === ENGINE_DECISIONS.keep && confidenceRank(result.confidence) >= 2);
}

function isLibraryLike(decision: Record<string, any>, requiredConsumerCount: number): boolean {
    const categories = collectHintCategories(decision);
    const fileName = String(decision.fileName || '').toLowerCase();
    const currentRole = getRoleState(decision).roleType;

    return categories.has('library')
        || currentRole === 'client-library'
        || currentRole === 'common-library'
        || requiredConsumerCount >= 2
        || /(^|[-_.])(lib|library|api|core)([-_.]|$)/i.test(fileName);
}

function isCompatLike(decision: Record<string, any>): boolean {
    const categories = collectHintCategories(decision);
    const currentRole = getRoleState(decision).roleType;
    return categories.has('compat') || currentRole === 'compat-client' || /compat/i.test(String(decision.fileName || ''));
}

function collectStrongFamilyDecisions(
    relatedFileNames: string[],
    decisionByFile: Map<string, Record<string, any>>
): {
    client: Array<Record<string, any>>;
    common: Array<Record<string, any>>;
} {
    const buckets = {
        client: [] as Array<Record<string, any>>,
        common: [] as Array<Record<string, any>>
    };

    for (const fileName of relatedFileNames) {
        const decision = decisionByFile.get(fileName);

        if (!decision) {
            continue;
        }

        const roleState = getRoleState(decision);

        if (confidenceRank(roleState.roleConfidence) < 2) {
            continue;
        }

        if (roleState.roleFamily === 'client') {
            buckets.client.push(decision);
        } else if (roleState.roleFamily === 'common') {
            buckets.common.push(decision);
        }
    }

    return buckets;
}

function buildPropagationEvidence({
    requiredConsumers,
    requiredProviders,
    categories
}: {
    requiredConsumers: Array<Record<string, any>>;
    requiredProviders: Array<Record<string, any>>;
    categories: Set<string>;
}) {
    const evidence = [];
    const consumerNames = listSampleNames(requiredConsumers);
    const providerNames = listSampleNames(requiredProviders);

    if (consumerNames.length > 0) {
        evidence.push({
            type: 'required-by',
            value: consumerNames.join(', '),
            source: 'dependency-graph'
        });
    }

    if (providerNames.length > 0) {
        evidence.push({
            type: 'requires',
            value: providerNames.join(', '),
            source: 'dependency-graph'
        });
    }

    if (categories.size > 0) {
        evidence.push({
            type: 'archive-hints',
            value: [...categories].sort().join(', '),
            source: 'archive-index'
        });
    }

    return evidence;
}

function createRoleSignal(
    roleType: RoleType,
    confidence: ConfidenceLevel,
    reason: string,
    existingSignals: RoleSignal[] = []
): RoleSignal[] {
    const filteredSignals = existingSignals.filter((signal) => signal.engine !== DEPENDENCY_ROLE_ENGINE);

    filteredSignals.push({
        engine: DEPENDENCY_ROLE_ENGINE,
        roleType,
        confidence,
        reason
    });

    return filteredSignals;
}

function patchClassificationRole(
    classification: FinalClassification,
    suggestion: PropagationSuggestion
): FinalClassification {
    return {
        ...classification,
        finalRoleType: suggestion.roleType,
        roleConfidence: suggestion.confidence,
        roleReason: suggestion.reason,
        roleOrigin: DEPENDENCY_ROLE_ENGINE,
        roleSignals: createRoleSignal(
            suggestion.roleType,
            suggestion.confidence,
            suggestion.reason,
            classification.roleSignals || []
        )
    };
}

function applyClassificationPatch(decision: Record<string, any>, classification: FinalClassification): Record<string, any> {
    const classificationDecision = classification.finalDecision === ENGINE_DECISIONS.remove ? 'exclude' : 'keep';

    return finalizeDecision(decision, {
        classification,
        classificationDecision,
        classificationReason: classification.reason,
        decision: classificationDecision,
        reason: classification.reason,
        decisionOrigin: 'classification',
        finalRoleType: classification.finalRoleType,
        roleConfidence: classification.roleConfidence,
        roleOrigin: classification.roleOrigin,
        roleReason: classification.roleReason,
        finalConfidence: classification.confidence
    });
}

function buildKeepRoleSuggestion(
    decision: Record<string, any>,
    roleType: RoleType,
    confidence: ConfidenceLevel,
    reason: string,
    requiredConsumers: Array<Record<string, any>>,
    requiredProviders: Array<Record<string, any>>,
    categories: Set<string>
): PropagationSuggestion {
    const firstConsumer = requiredConsumers[0];

    return {
        kind: 'keep-role',
        roleType,
        confidence,
        reason,
        evidence: buildPropagationEvidence({
            requiredConsumers,
            requiredProviders,
            categories
        }),
        findings: [
            createDependencyFinding({
                type: FINDING_TYPES.rolePropagation,
                severity: 'info',
                fileName: decision.fileName,
                message: reason
            }),
            createDependencyFinding({
                type: FINDING_TYPES.preservedByDependency,
                severity: 'info',
                fileName: decision.fileName,
                modId: decision.descriptor?.modIds?.[0] || null,
                requiredByFileName: firstConsumer ? firstConsumer.fileName : null,
                message: reason
            })
        ]
    };
}

function buildRemoveSuggestion(
    decision: Record<string, any>,
    roleType: RoleType,
    confidence: ConfidenceLevel,
    reason: string,
    requiredConsumers: Array<Record<string, any>>,
    requiredProviders: Array<Record<string, any>>,
    categories: Set<string>
): PropagationSuggestion {
    return {
        kind: 'remove',
        roleType,
        confidence,
        reason,
        evidence: buildPropagationEvidence({
            requiredConsumers,
            requiredProviders,
            categories
        }),
        findings: [
            createDependencyFinding({
                type: FINDING_TYPES.rolePropagation,
                severity: 'info',
                fileName: decision.fileName,
                message: reason
            })
        ]
    };
}

function suggestRolePropagation({
    decision,
    node,
    graph,
    decisionByFile
}: {
    decision: Record<string, any>;
    node: DependencyGraph['nodes'][number];
    graph: DependencyGraph;
    decisionByFile: Map<string, Record<string, any>>;
}): PropagationSuggestion | null {
    const categories = collectHintCategories(decision);
    const requiredConsumers = (graph.incoming.requiredByFile[node.fileName] || [])
        .map((entry) => decisionByFile.get(entry.fileName))
        .filter((entry): entry is Record<string, any> => Boolean(entry));
    const requiredProviders = node.requiredEdges
        .filter((edge) => edge.resolution === GRAPH_RESOLUTIONS.unique || edge.resolution === GRAPH_RESOLUTIONS.self)
        .map((edge) => {
            const providerFileName = edge.providerFileNames[0];
            return providerFileName ? decisionByFile.get(providerFileName) : null;
        })
        .filter((entry): entry is Record<string, any> => Boolean(entry))
        .filter((provider) => provider.fileName !== decision.fileName);
    const consumerFamilies = collectStrongFamilyDecisions(requiredConsumers.map((entry) => entry.fileName), decisionByFile);
    const providerFamilies = collectStrongFamilyDecisions(requiredProviders.map((entry) => entry.fileName), decisionByFile);
    const currentRole = getRoleState(decision).roleType;
    const libraryLike = isLibraryLike(decision, requiredConsumers.length);
    const compatLike = isCompatLike(decision);

    if (libraryLike && consumerFamilies.common.length > 0) {
        const confidence = consumerFamilies.common.length >= 2 ? CONFIDENCE_LEVELS.high : CONFIDENCE_LEVELS.medium;
        const consumerNames = listSampleNames(consumerFamilies.common);

        return buildKeepRoleSuggestion(
            decision,
            'common-library',
            confidence,
            `Dependency role propagation classified this jar as a common library because ${consumerNames.join(', ')} require it`,
            requiredConsumers,
            requiredProviders,
            categories
        );
    }

    if (
        libraryLike
        && consumerFamilies.client.length > 0
        && consumerFamilies.common.length === 0
        && !hasStrongKeepSignal(decision.classification)
    ) {
        const confidence = CONFIDENCE_LEVELS.high;
        const consumerNames = listSampleNames(consumerFamilies.client);

        return buildRemoveSuggestion(
            decision,
            'client-library',
            confidence,
            `Dependency role propagation classified this jar as a client library because only client-facing mods require it: ${consumerNames.join(', ')}`,
            requiredConsumers,
            requiredProviders,
            categories
        );
    }

    if (compatLike && (consumerFamilies.common.length > 0 || providerFamilies.common.length > 0)) {
        const commonRole = determineCommonRole(categories);
        const confidence = consumerFamilies.common.length > 0 ? CONFIDENCE_LEVELS.medium : CONFIDENCE_LEVELS.low;
        const relatedCommon = listSampleNames([
            ...consumerFamilies.common,
            ...providerFamilies.common
        ]);

        return buildKeepRoleSuggestion(
            decision,
            commonRole,
            confidence,
            `Dependency role propagation classified this jar as common-side because it connects to common mods: ${relatedCommon.join(', ')}`,
            requiredConsumers,
            requiredProviders,
            categories
        );
    }

    if (
        compatLike
        && (consumerFamilies.client.length > 0 || providerFamilies.client.length > 0)
        && consumerFamilies.common.length === 0
        && providerFamilies.common.length === 0
        && !hasStrongKeepSignal(decision.classification)
    ) {
        const confidence = CONFIDENCE_LEVELS.high;
        const relatedClient = listSampleNames([
            ...consumerFamilies.client,
            ...providerFamilies.client
        ]);

        return buildRemoveSuggestion(
            decision,
            'compat-client',
            confidence,
            `Dependency role propagation classified this jar as client compat because it only connects to client-facing mods: ${relatedClient.join(', ')}`,
            requiredConsumers,
            requiredProviders,
            categories
        );
    }

    if (
        currentRole === 'unknown'
        && consumerFamilies.common.length > 0
        && consumerFamilies.client.length === 0
    ) {
        const commonRole = determineCommonRole(categories);
        const confidence = consumerFamilies.common.length >= 2 ? CONFIDENCE_LEVELS.high : CONFIDENCE_LEVELS.medium;
        const consumerNames = listSampleNames(consumerFamilies.common);

        return buildKeepRoleSuggestion(
            decision,
            commonRole,
            confidence,
            `Dependency role propagation classified this jar as common-side because common mods require it: ${consumerNames.join(', ')}`,
            requiredConsumers,
            requiredProviders,
            categories
        );
    }

    if (
        currentRole === 'unknown'
        && consumerFamilies.client.length > 0
        && consumerFamilies.common.length === 0
        && (categories.has('ui') || categories.has('visual') || categories.has('qol'))
        && !hasStrongKeepSignal(decision.classification)
    ) {
        const clientRole = determineClientRole(categories);
        const confidence = CONFIDENCE_LEVELS.high;
        const consumerNames = listSampleNames(consumerFamilies.client);

        return buildRemoveSuggestion(
            decision,
            clientRole,
            confidence,
            `Dependency role propagation classified this jar as client-side because only client-facing mods require it: ${consumerNames.join(', ')}`,
            requiredConsumers,
            requiredProviders,
            categories
        );
    }

    return null;
}

function applyDependencyRolePropagation({
    decisions,
    graph,
    record = () => {}
}: {
    decisions: Array<Record<string, any>>;
    graph: DependencyGraph;
    record?: (level: string, kind: string, message: string) => void;
}): PropagationResult {
    const decisionByFile = new Map(decisions.map((decision) => [decision.fileName, decision]));
    const initialFindingsByFile: Record<string, DependencyFinding[]> = {};
    const summary: PropagationSummary = {
        rolePropagations: 0,
        roleKeepConstraints: 0,
        roleRemoveSignals: 0
    };

    const nextDecisions = decisions.map((decision) => {
        const node = graph.nodes.find((entry) => entry.fileName === decision.fileName);

        if (!node || !decision.classification) {
            return decision;
        }

        const suggestion = suggestRolePropagation({
            decision,
            node,
            graph,
            decisionByFile
        });

        if (!suggestion) {
            return decision;
        }

        summary.rolePropagations += 1;
        initialFindingsByFile[decision.fileName] = suggestion.findings;

        if (suggestion.kind === 'keep-role') {
            summary.roleKeepConstraints += 1;
            record('info', 'dependency', `${decision.fileName}: ${suggestion.reason}`);

            const nextClassification = patchClassificationRole(decision.classification, suggestion);
            const nextDecision = finalizeDecision(decision, {
                classification: nextClassification,
                finalRoleType: nextClassification.finalRoleType,
                roleConfidence: nextClassification.roleConfidence,
                roleOrigin: nextClassification.roleOrigin,
                roleReason: nextClassification.roleReason
            });
            decisionByFile.set(decision.fileName, nextDecision);
            return nextDecision;
        }

        summary.roleRemoveSignals += 1;
        record('info', 'dependency', `${decision.fileName}: ${suggestion.reason}`);

        const existingResults = (decision.classification.results || []).filter((result: { engine: string }) => result.engine !== DEPENDENCY_ROLE_ENGINE);
        const propagatedResult = createEngineResult({
            engine: DEPENDENCY_ROLE_ENGINE,
            decision: ENGINE_DECISIONS.remove,
            confidence: suggestion.confidence,
            reason: suggestion.reason,
            evidence: suggestion.evidence,
            roleType: suggestion.roleType,
            roleConfidence: suggestion.confidence,
            roleReason: suggestion.reason
        });
        let nextClassification = mergeClassificationResults([...existingResults, propagatedResult]);

        if (nextClassification.finalRoleType !== suggestion.roleType || nextClassification.roleOrigin !== DEPENDENCY_ROLE_ENGINE) {
            nextClassification = patchClassificationRole(nextClassification, suggestion);
        }

        const nextDecision = applyClassificationPatch(decision, nextClassification);
        decisionByFile.set(decision.fileName, nextDecision);
        return nextDecision;
    });

    return {
        decisions: nextDecisions,
        initialFindingsByFile,
        summary
    };
}

module.exports = {
    applyDependencyRolePropagation
};
