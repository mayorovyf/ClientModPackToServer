import type {
    DependencyDescriptor,
    EntrypointDescriptor,
    LoaderKind,
    MetadataError,
    MetadataWarning,
    SideHint
} from './metadata';

export interface ModDescriptor {
    fileName: string;
    filePath: string;
    fileSize: number | null;
    loader: LoaderKind;
    modIds: string[];
    displayName: string | null;
    version: string | null;
    metadataFilesFound: string[];
    declaredSide: SideHint;
    entrypoints: EntrypointDescriptor[];
    mixinConfigs: string[];
    dependencies: DependencyDescriptor[];
    optionalDependencies: DependencyDescriptor[];
    incompatibilities: DependencyDescriptor[];
    provides: string[];
    manifestHints: Record<string, string>;
    parsingWarnings: MetadataWarning[];
    parsingErrors: MetadataError[];
}

export interface DescriptorPatch {
    loader?: LoaderKind;
    modIds?: string[];
    displayName?: string | null;
    version?: string | null;
    metadataFilesFound?: string[];
    declaredSide?: SideHint | string | null;
    entrypoints?: EntrypointDescriptor[];
    mixinConfigs?: string[];
    dependencies?: DependencyDescriptor[];
    optionalDependencies?: DependencyDescriptor[];
    incompatibilities?: DependencyDescriptor[];
    provides?: string[];
    manifestHints?: Record<string, string>;
    parsingWarnings?: MetadataWarning[];
    parsingErrors?: MetadataError[];
}

export interface DescriptorSummary {
    fileName: string;
    loader: LoaderKind;
    modIds: string[];
    displayName: string | null;
    version: string | null;
    declaredSide: SideHint;
    metadataFilesFound: string[];
    dependencies: number;
    optionalDependencies: number;
    incompatibilities: number;
    parsingWarnings: number;
    parsingErrors: number;
}
