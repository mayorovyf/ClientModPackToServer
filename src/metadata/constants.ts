const LOADER_TYPES = Object.freeze({
    fabric: 'fabric',
    quilt: 'quilt',
    forge: 'forge',
    neoforge: 'neoforge',
    unknown: 'unknown'
});

const DECLARED_SIDES = Object.freeze({
    client: 'client',
    server: 'server',
    both: 'both',
    unknown: 'unknown'
});

module.exports = {
    DECLARED_SIDES,
    LOADER_TYPES
};
