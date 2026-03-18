const REGISTRY_SCHEMA_VERSION = 1;

const SUPPORTED_REGISTRY_SCHEMA_VERSIONS = Object.freeze([REGISTRY_SCHEMA_VERSION]);

const REGISTRY_RUNTIME_MODES = Object.freeze({
    auto: 'auto',
    offline: 'offline',
    refresh: 'refresh',
    pinned: 'pinned'
});

const REGISTRY_RUNTIME_SOURCES = Object.freeze({
    embedded: 'embedded-fallback',
    cacheCurrent: 'cache-current',
    cachePrevious: 'cache-previous',
    empty: 'empty'
});

const REGISTRY_CACHE_FILE_NAMES = Object.freeze({
    manifest: 'manifest.json',
    bundle: 'registry.bundle.json',
    previousManifest: 'previous.manifest.json',
    previousBundle: 'previous.bundle.json'
});

const DEFAULT_REGISTRY_FETCH_TIMEOUT_MS = 5000;
const DEFAULT_REGISTRY_CACHE_DIR_NAME = 'cache';
const DEFAULT_REGISTRY_CACHE_SUBDIR_NAME = 'registry';
const DEFAULT_LOCAL_REGISTRY_DIR_NAME = 'data';
const DEFAULT_LOCAL_REGISTRY_FILE_NAME = 'local-registry.json';
const DEFAULT_LOCAL_OVERRIDES_FILE_NAME = 'local-overrides.json';
const DEFAULT_LOCAL_OVERRIDE_PRIORITY = 1000;
const FORCE_LOCAL_OVERRIDE_PRIORITY = 10000;

module.exports = {
    DEFAULT_LOCAL_OVERRIDE_PRIORITY,
    DEFAULT_LOCAL_OVERRIDES_FILE_NAME,
    DEFAULT_LOCAL_REGISTRY_DIR_NAME,
    DEFAULT_LOCAL_REGISTRY_FILE_NAME,
    DEFAULT_REGISTRY_CACHE_DIR_NAME,
    DEFAULT_REGISTRY_CACHE_SUBDIR_NAME,
    DEFAULT_REGISTRY_FETCH_TIMEOUT_MS,
    FORCE_LOCAL_OVERRIDE_PRIORITY,
    REGISTRY_CACHE_FILE_NAMES,
    REGISTRY_RUNTIME_MODES,
    REGISTRY_RUNTIME_SOURCES,
    REGISTRY_SCHEMA_VERSION,
    SUPPORTED_REGISTRY_SCHEMA_VERSIONS
};
