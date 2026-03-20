const PROBE_MODES = Object.freeze({
    off: 'off',
    auto: 'auto',
    force: 'force'
});

const DEFAULT_PROBE_TIMEOUT_MS = 12000;
const DEFAULT_PROBE_MAX_MODS = 8;

module.exports = {
    DEFAULT_PROBE_MAX_MODS,
    DEFAULT_PROBE_TIMEOUT_MS,
    PROBE_MODES
};
