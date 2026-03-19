export type ServerCoreType = 'fabric' | 'forge' | 'neoforge';
export type ManagedServerEntrypointKind = 'jar' | 'cmd-script' | 'powershell-script' | 'node-script' | 'executable' | 'shell-script';

export interface ManagedServerEntrypoint {
    path: string;
    originalPath: string;
    source: 'auto' | 'explicit';
    kind: ManagedServerEntrypointKind;
}

export interface ServerCoreInstallRequest {
    targetDir: string;
    coreType: ServerCoreType;
    minecraftVersion: string;
    loaderVersion?: string | null;
    javaPath?: string | null;
    acceptEula?: boolean;
}

export interface ServerCoreInstallResult {
    coreType: ServerCoreType;
    targetDir: string;
    minecraftVersion: string;
    loaderVersion: string;
    entrypointPath: string | null;
    downloadedArtifactPath: string | null;
    installedAt: string;
    notes: string[];
}

export interface ManagedServerCommand {
    command: string;
    args: string[];
}
