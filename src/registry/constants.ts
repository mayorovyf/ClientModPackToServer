export const REGISTRY_SCHEMA_VERSION = 1;

export const SUPPORTED_REGISTRY_SCHEMA_VERSIONS = Object.freeze([REGISTRY_SCHEMA_VERSION]);

export const REGISTRY_RUNTIME_MODES = Object.freeze({
    auto: 'auto',
    offline: 'offline',
    refresh: 'refresh',
    pinned: 'pinned'
});

export const REGISTRY_RUNTIME_SOURCES = Object.freeze({
    embedded: 'embedded-fallback',
    cacheCurrent: 'cache-current',
    cachePrevious: 'cache-previous',
    empty: 'empty'
});

export const REGISTRY_CACHE_FILE_NAMES = Object.freeze({
    manifest: 'manifest.json',
    bundle: 'registry.bundle.json',
    previousManifest: 'previous.manifest.json',
    previousBundle: 'previous.bundle.json'
});

export const DEFAULT_REGISTRY_FETCH_TIMEOUT_MS = 5000;
export const DEFAULT_REGISTRY_CACHE_DIR_NAME = 'cache';
export const DEFAULT_REGISTRY_CACHE_SUBDIR_NAME = 'registry';
export const DEFAULT_LOCAL_REGISTRY_DIR_NAME = 'data';
export const DEFAULT_LOCAL_REGISTRY_FILE_NAME = 'local-registry.json';
export const DEFAULT_LOCAL_OVERRIDES_FILE_NAME = 'local-overrides.json';
export const DEFAULT_LOCAL_OVERRIDE_PRIORITY = 1000;
export const FORCE_LOCAL_OVERRIDE_PRIORITY = 10000;

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
