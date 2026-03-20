const SUPPORTED_LAYOUT_INPUT_KINDS = ['instance', 'mods-directory'] as const;
const SUPPORTED_LAYOUT_SOURCES = ['direct', 'mods-directory', 'minecraft-subdir', 'dot-minecraft-subdir'] as const;
const SUPPORTED_LOADERS = ['fabric', 'quilt', 'forge', 'neoforge'] as const;
const SUPPORTED_VALIDATION_ENTRYPOINT_KINDS = ['jar', 'node-script', 'cmd-script', 'powershell-script', 'executable'] as const;
const SUPPORTED_MANAGED_SERVER_ENTRYPOINT_KINDS = ['jar', 'cmd-script', 'powershell-script', 'node-script', 'executable', 'shell-script'] as const;
const SUPPORTED_SERVER_CORE_TYPES = ['fabric', 'forge', 'neoforge'] as const;

module.exports = {
    SUPPORTED_LAYOUT_INPUT_KINDS,
    SUPPORTED_LAYOUT_SOURCES,
    SUPPORTED_LOADERS,
    SUPPORTED_VALIDATION_ENTRYPOINT_KINDS,
    SUPPORTED_MANAGED_SERVER_ENTRYPOINT_KINDS,
    SUPPORTED_SERVER_CORE_TYPES
};
