const CLIENT_NAMESPACE_PATTERNS = Object.freeze([
    'net/minecraft/client/',
    '/client/',
    '/screen/',
    '/gui/',
    '/render/',
    '/renderer/',
    '/keybind',
    '/keybinding',
    '/hud/',
    '/tooltip/'
]);

const CLIENT_RESOURCE_PATTERNS = Object.freeze([
    'assets/minecraft/shaders/',
    'assets/minecraft/particles/',
    'assets/minecraft/textures/gui/',
    'assets/minecraft/models/item/',
    'assets/minecraft/lang/'
]);

const SERVER_SAFE_PATTERNS = Object.freeze([
    'net/minecraft/server/',
    'net/minecraft/server/dedicated/',
    '/server/',
    '/dedicated/'
]);

const CLIENT_ENTRYPOINT_KEYWORDS = Object.freeze([
    'client',
    'screen',
    'render',
    'gui',
    'hud'
]);

const SERVER_ENTRYPOINT_KEYWORDS = Object.freeze([
    'server',
    'dedicated',
    'common'
]);

module.exports = {
    CLIENT_ENTRYPOINT_KEYWORDS,
    CLIENT_NAMESPACE_PATTERNS,
    CLIENT_RESOURCE_PATTERNS,
    SERVER_ENTRYPOINT_KEYWORDS,
    SERVER_SAFE_PATTERNS
};
