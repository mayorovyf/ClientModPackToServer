const { buildFindingSummary, createDependencyFinding } = require('./findings');
const { FINDING_TYPES, GRAPH_RESOLUTIONS, VALIDATION_MODES } = require('./constants');

import type {
    DependencyFinding,
    DependencyGraph,
    DependencyIncomingSummary,
    DependencyOutgoingSummary,
    DependencyValidationResult,
    DependencyValidationUpdate
} from '../types/dependency';

function createFindingStore(decisions: Array<Record<string, any>>) {
    const findingsByFile: Record<string, DependencyFinding[]> = {};
    const seenByFile: Record<string, Set<string>> = {};

    for (const decision of decisions) {
        findingsByFile[decision.fileName] = [];
        seenByFile[decision.fileName] = new Set();
    }

    return {
        add(fileName: string, finding: DependencyFinding) {
            let fileFindings = findingsByFile[fileName];
            let seenKeys = seenByFile[fileName];

            if (!fileFindings || !seenKeys) {
                findingsByFile[fileName] = [];
                seenByFile[fileName] = new Set();
                fileFindings = findingsByFile[fileName];
                seenKeys = seenByFile[fileName];
            }

            const key = [
                finding.type,
                finding.fileName,
                finding.modId,
                finding.providerFileName,
                (finding.providerFileNames || []).join(','),
                finding.requiredByFileName
            ].join('|');

            if (!fileFindings || !seenKeys) {
                return;
            }

            if (seenKeys.has(key)) {
                return;
            }

            seenKeys.add(key);
            fileFindings.push(finding);
        },
        all() {
            return Object.values(findingsByFile).flat();
        },
        byFile: findingsByFile
    };
}

function buildOutgoingSummary(node: DependencyGraph['nodes'][number], effectiveDecisionByFile: Record<string, string>): DependencyOutgoingSummary {
    const serializeEdges = (edges: typeof node.requiredEdges) =>
        edges.map((edge) => ({
            modId: edge.modId,
            kind: edge.kind,
            resolution: edge.resolution,
            providerFileNames: [...edge.providerFileNames],
            providerDecisionStates: edge.providerFileNames.map((fileName) => ({
                fileName,
                decision: effectiveDecisionByFile[fileName] || 'unknown'
            })),
            loaderOrigin: edge.loaderOrigin,
            versionRange: edge.versionRange,
            sideHint: edge.sideHint
        }));

    return {
        required: serializeEdges(node.requiredEdges),
        optional: serializeEdges(node.optionalEdges),
        incompatibilities: serializeEdges(node.incompatibilityEdges)
    };
}

function buildIncomingSummary(graph: DependencyGraph, fileName: string, effectiveDecisionByFile: Record<string, string>): DependencyIncomingSummary {
    const serializeEntries = (entries: Array<{
        fileName: string;
        modId: string | null;
        kind: string;
        loaderOrigin: any;
        versionRange: string | null;
        sideHint: any;
    }> = []) =>
        entries.map((entry) => ({
            fileName: entry.fileName,
            modId: entry.modId,
            kind: entry.kind,
            decision: effectiveDecisionByFile[entry.fileName] || 'unknown',
            loaderOrigin: entry.loaderOrigin,
            versionRange: entry.versionRange,
            sideHint: entry.sideHint
        }));

    return {
        requiredBy: serializeEntries(graph.incoming.requiredByFile[fileName]),
        optionalBy: serializeEntries(graph.incoming.optionalByFile[fileName]),
        incompatibleWith: serializeEntries(graph.incoming.incompatibleWithFile[fileName])
    };
}

function buildPreservationReason(findings: DependencyFinding[]): string | null {
    const preservedFindings = findings.filter((finding) => finding.type === FINDING_TYPES.preservedByDependency);

    if (preservedFindings.length === 0) {
        return null;
    }

    if (preservedFindings.length === 1) {
        const finding = preservedFindings[0];

        if (!finding) {
            return null;
        }

        return `Dependency validation preserved this jar because ${finding.requiredByFileName} requires ${finding.modId}`;
    }

    return `Dependency validation preserved this jar because it is required by ${preservedFindings.length} kept mods`;
}

function shouldPreserveProviders(mode: string): boolean {
    return mode === VALIDATION_MODES.conservative || mode === VALIDATION_MODES.strict;
}

function runDependencyValidation({
    decisions,
    graph,
    mode = VALIDATION_MODES.conservative,
    record = () => {}
}: {
    decisions: Array<Record<string, any>>;
    graph: DependencyGraph;
    mode?: string;
    record?: (level: string, kind: string, message: string) => void;
}): DependencyValidationResult {
    const effectiveDecisionByFile = Object.fromEntries(decisions.map((decision) => [decision.fileName, decision.decision])) as Record<string, string>;
    const findings = createFindingStore(decisions);

    if (shouldPreserveProviders(mode)) {
        let changed = true;

        while (changed) {
            changed = false;

            for (const node of graph.nodes) {
                if (effectiveDecisionByFile[node.fileName] !== 'keep') {
                    continue;
                }

                for (const edge of node.requiredEdges) {
                    if (edge.resolution !== GRAPH_RESOLUTIONS.unique) {
                        continue;
                    }

                    const providerFileName = edge.providerFileNames[0];

                    if (!providerFileName || providerFileName === node.fileName) {
                        continue;
                    }

                    if (effectiveDecisionByFile[providerFileName] === 'exclude') {
                        effectiveDecisionByFile[providerFileName] = 'keep';
                        findings.add(
                            providerFileName,
                            createDependencyFinding({
                                type: FINDING_TYPES.preservedByDependency,
                                severity: 'info',
                                fileName: providerFileName,
                                modId: edge.modId,
                                providerFileName,
                                dependencyKind: edge.kind,
                                requiredByFileName: node.fileName,
                                loaderOrigin: edge.loaderOrigin,
                                versionRange: edge.versionRange,
                                sideHint: edge.sideHint,
                                message: `Preserved because ${node.fileName} requires ${edge.modId}`
                            })
                        );
                        record('warn', 'dependency-preserve', `${providerFileName}: preserved because ${node.fileName} requires ${edge.modId}`);
                        changed = true;
                    }
                }
            }
        }
    }

    for (const node of graph.nodes) {
        if (effectiveDecisionByFile[node.fileName] !== 'keep') {
            continue;
        }

        for (const edge of node.requiredEdges) {
            if (edge.resolution === GRAPH_RESOLUTIONS.missing) {
                findings.add(
                    node.fileName,
                    createDependencyFinding({
                        type: FINDING_TYPES.missingRequired,
                        fileName: node.fileName,
                        modId: edge.modId,
                        dependencyKind: edge.kind,
                        loaderOrigin: edge.loaderOrigin,
                        versionRange: edge.versionRange,
                        sideHint: edge.sideHint,
                        message: `Required dependency ${edge.modId} is missing`
                    })
                );
                record('warn', 'dependency', `${node.fileName}: missing required dependency ${edge.modId}`);
                continue;
            }

            if (edge.resolution === GRAPH_RESOLUTIONS.ambiguous) {
                findings.add(
                    node.fileName,
                    createDependencyFinding({
                        type: FINDING_TYPES.providerAmbiguous,
                        fileName: node.fileName,
                        modId: edge.modId,
                        providerFileNames: edge.providerFileNames,
                        dependencyKind: edge.kind,
                        loaderOrigin: edge.loaderOrigin,
                        versionRange: edge.versionRange,
                        sideHint: edge.sideHint,
                        message: `Required dependency ${edge.modId} has multiple providers: ${edge.providerFileNames.join(', ')}`
                    })
                );
                record('warn', 'dependency', `${node.fileName}: ambiguous provider for required dependency ${edge.modId}`);
                continue;
            }

            if (edge.resolution === GRAPH_RESOLUTIONS.unique) {
                const providerFileName = edge.providerFileNames[0];

                if (!providerFileName) {
                    continue;
                }

                if (effectiveDecisionByFile[providerFileName] !== 'keep') {
                    findings.add(
                        node.fileName,
                        createDependencyFinding({
                            type: FINDING_TYPES.missingRequired,
                            fileName: node.fileName,
                            modId: edge.modId,
                            providerFileName,
                            dependencyKind: edge.kind,
                            loaderOrigin: edge.loaderOrigin,
                            versionRange: edge.versionRange,
                            sideHint: edge.sideHint,
                            message: `Required dependency ${edge.modId} resolved to ${providerFileName}, but that jar is not kept`
                        })
                    );
                    record('warn', 'dependency', `${node.fileName}: required dependency ${edge.modId} resolves to removed jar ${providerFileName}`);
                }
            }
        }

        for (const edge of node.optionalEdges) {
            if (edge.resolution === GRAPH_RESOLUTIONS.missing) {
                findings.add(
                    node.fileName,
                    createDependencyFinding({
                        type: FINDING_TYPES.missingOptional,
                        severity: 'info',
                        fileName: node.fileName,
                        modId: edge.modId,
                        dependencyKind: edge.kind,
                        loaderOrigin: edge.loaderOrigin,
                        versionRange: edge.versionRange,
                        sideHint: edge.sideHint,
                        message: `Optional dependency ${edge.modId} is missing`
                    })
                );
                continue;
            }

            if (edge.resolution === GRAPH_RESOLUTIONS.ambiguous) {
                findings.add(
                    node.fileName,
                    createDependencyFinding({
                        type: FINDING_TYPES.providerAmbiguous,
                        severity: 'info',
                        fileName: node.fileName,
                        modId: edge.modId,
                        providerFileNames: edge.providerFileNames,
                        dependencyKind: edge.kind,
                        loaderOrigin: edge.loaderOrigin,
                        versionRange: edge.versionRange,
                        sideHint: edge.sideHint,
                        message: `Optional dependency ${edge.modId} has multiple providers: ${edge.providerFileNames.join(', ')}`
                    })
                );
                continue;
            }

            if (edge.resolution === GRAPH_RESOLUTIONS.unique) {
                const providerFileName = edge.providerFileNames[0];

                if (!providerFileName) {
                    continue;
                }

                if (effectiveDecisionByFile[providerFileName] !== 'keep') {
                    findings.add(
                        node.fileName,
                        createDependencyFinding({
                            type: FINDING_TYPES.missingOptional,
                            severity: 'info',
                            fileName: node.fileName,
                            modId: edge.modId,
                            providerFileName,
                            dependencyKind: edge.kind,
                            loaderOrigin: edge.loaderOrigin,
                            versionRange: edge.versionRange,
                            sideHint: edge.sideHint,
                            message: `Optional dependency ${edge.modId} resolved to ${providerFileName}, but that jar is not kept`
                        })
                    );
                }
            }
        }

        for (const edge of node.incompatibilityEdges) {
            const conflictingProviders = edge.providerFileNames.filter((fileName) => fileName !== node.fileName && effectiveDecisionByFile[fileName] === 'keep');

            if (conflictingProviders.length === 0) {
                continue;
            }

            findings.add(
                node.fileName,
                createDependencyFinding({
                    type: FINDING_TYPES.incompatibility,
                    fileName: node.fileName,
                    modId: edge.modId,
                    providerFileNames: conflictingProviders,
                    dependencyKind: edge.kind,
                    loaderOrigin: edge.loaderOrigin,
                    versionRange: edge.versionRange,
                    sideHint: edge.sideHint,
                    message: `Incompatibility detected: ${node.fileName} conflicts with provider(s) of ${edge.modId}: ${conflictingProviders.join(', ')}`
                })
            );
            record('warn', 'dependency', `${node.fileName}: incompatibility with ${edge.modId} provided by ${conflictingProviders.join(', ')}`);
        }
    }

    const decisionUpdatesByFile: Record<string, DependencyValidationUpdate> = {};

    for (const decision of decisions) {
        const node = graph.nodes.find((entry) => entry.fileName === decision.fileName);
        const fileFindings = findings.byFile[decision.fileName] || [];
        const dependencyReason = buildPreservationReason(fileFindings);
        const nextDecision = effectiveDecisionByFile[decision.fileName] || decision.decision;
        const dependencyAdjusted = decision.decision !== nextDecision;

        decisionUpdatesByFile[decision.fileName] = {
            decision: nextDecision,
            reason: dependencyAdjusted && dependencyReason ? dependencyReason : decision.reason,
            decisionOrigin: dependencyAdjusted ? 'dependency-preserve' : decision.decisionOrigin,
            dependencyAdjusted,
            dependencyReason,
            dependencyFindings: fileFindings,
            dependencyDependencies: node ? buildOutgoingSummary(node, effectiveDecisionByFile) : {
                required: [],
                optional: [],
                incompatibilities: []
            },
            dependencyDependents: buildIncomingSummary(graph, decision.fileName, effectiveDecisionByFile)
        };
    }

    const allFindings = findings.all();

    return {
        mode: mode as DependencyValidationResult['mode'],
        effectiveDecisionByFile,
        findings: allFindings,
        summary: buildFindingSummary(allFindings, graph.summary),
        decisionUpdatesByFile
    };
}

module.exports = {
    runDependencyValidation
};
