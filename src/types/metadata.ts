export type LoaderKind = 'fabric' | 'quilt' | 'forge' | 'neoforge' | 'unknown';
export type SideHint = 'client' | 'server' | 'both' | 'unknown';
export type DependencyKind = 'depends' | 'recommends' | 'conflicts' | 'breaks' | 'unknown';

export interface DependencyDescriptor {
    modId: string | null;
    kind: DependencyKind | string;
    required: boolean;
    versionRange?: string | null;
    loaderOrigin: LoaderKind;
    sideHint?: SideHint | null;
}

export interface EntrypointDescriptor {
    loaderOrigin: LoaderKind;
    key: string;
    value: string | null;
    adapter?: string | null;
}

export interface MetadataIssue {
    source: string;
    code: string;
    message: string;
    fatal?: boolean;
}

export type MetadataWarning = MetadataIssue;
export type MetadataError = MetadataIssue;
