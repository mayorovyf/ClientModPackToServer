const GRAPH_RESOLUTIONS = Object.freeze({
    missing: 'missing',
    platform: 'platform',
    unique: 'unique',
    ambiguous: 'ambiguous',
    self: 'self'
});

const FINDING_TYPES = Object.freeze({
    missingRequired: 'missing-required',
    missingOptional: 'missing-optional',
    providerAmbiguous: 'provider-ambiguous',
    incompatibility: 'incompatibility',
    preservedByDependency: 'preserved-by-dependency',
    orphanLibrary: 'orphan-library'
});

const VALIDATION_MODES = Object.freeze({
    conservative: 'conservative',
    reportOnly: 'report-only',
    strict: 'strict'
});

module.exports = {
    FINDING_TYPES,
    GRAPH_RESOLUTIONS,
    VALIDATION_MODES
};
