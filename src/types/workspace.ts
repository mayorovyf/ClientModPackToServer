export interface WorkspaceCoreInstallState {
    cacheKey: string | null;
    coreType: string | null;
    minecraftVersion: string | null;
    loaderVersion: string | null;
    entrypointPath: string | null;
    downloadedArtifactPath: string | null;
    installedAt: string | null;
}

export interface WorkspaceManifest {
    schemaVersion: 1;
    runId: string;
    initializedAt: string;
    updatedAt: string;
    inputPath: string;
    instancePath: string;
    modsPath: string;
    instanceSkeletonCopied: boolean;
    activeMods: string[];
    stashedMods: string[];
    eulaAccepted: boolean;
    coreInstall: WorkspaceCoreInstallState | null;
}

export interface WorkspaceMaterializationStats {
    copied: number;
    linked: number;
    reused: number;
    restoredFromStash: number;
    movedToStash: number;
    removedStale: number;
    skeletonEntriesCopied: number;
    validationOnly: boolean;
}

export interface ValidationSandboxStats {
    linkedFiles: number;
    copiedFiles: number;
    copiedDirectories: number;
}

export interface CandidateDelta {
    desiredKeepFiles: string[];
    desiredExcludeFiles: string[];
    modsToAdd: string[];
    modsToReuse: string[];
    modsToRestoreFromStash: string[];
    modsToStash: string[];
    eulaAccepted: boolean;
    validationOnly: boolean;
}
