const { FINDING_TYPES } = require('./constants');

function createDependencyFinding({
    type,
    severity = 'warn',
    fileName,
    message,
    modId = null,
    providerFileName = null,
    providerFileNames = [],
    dependencyKind = null,
    requiredByFileName = null,
    loaderOrigin = null,
    versionRange = null,
    sideHint = null
}) {
    return {
        type,
        severity,
        fileName,
        message,
        modId,
        providerFileName,
        providerFileNames: [...providerFileNames],
        dependencyKind,
        requiredByFileName,
        loaderOrigin,
        versionRange,
        sideHint
    };
}

function buildFindingSummary(findings = [], graphSummary = {}) {
    const summary = {
        status: 'ok',
        totalNodes: graphSummary.totalNodes || 0,
        totalEdges: graphSummary.totalEdges || 0,
        requiredEdges: graphSummary.requiredEdges || 0,
        optionalEdges: graphSummary.optionalEdges || 0,
        incompatibilityEdges: graphSummary.incompatibilityEdges || 0,
        multiModJars: graphSummary.multiModJars || 0,
        filesWithFindings: new Set(findings.map((finding) => finding.fileName).filter(Boolean)).size,
        totalFindings: findings.length,
        missingRequired: 0,
        missingOptional: 0,
        ambiguousProviders: 0,
        incompatibilities: 0,
        preservedByDependency: 0,
        orphanLibraries: 0,
        graphErrors: 0
    };

    for (const finding of findings) {
        switch (finding.type) {
            case FINDING_TYPES.missingRequired:
                summary.missingRequired += 1;
                break;
            case FINDING_TYPES.missingOptional:
                summary.missingOptional += 1;
                break;
            case FINDING_TYPES.providerAmbiguous:
                summary.ambiguousProviders += 1;
                break;
            case FINDING_TYPES.incompatibility:
                summary.incompatibilities += 1;
                break;
            case FINDING_TYPES.preservedByDependency:
                summary.preservedByDependency += 1;
                break;
            case FINDING_TYPES.orphanLibrary:
                summary.orphanLibraries += 1;
                break;
            default:
                break;
        }
    }

    return summary;
}

module.exports = {
    buildFindingSummary,
    createDependencyFinding
};
