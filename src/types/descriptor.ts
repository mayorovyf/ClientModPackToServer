import type {
    DependencyDescriptor,
    EntrypointDescriptor,
    LoaderKind,
    MetadataError,
    MetadataWarning,
    SideHint
} from './metadata';

export type ArchiveHintCategory = 'ui' | 'visual' | 'qol' | 'optimization' | 'library' | 'compat';

export interface BytecodeReachabilityIndex {
    analyzedClassCount: number;
    truncated: boolean;
    rootClasses: string[];
    rootClientReferenceCount: number;
    rootCommonReferenceCount: number;
    rootServerReferenceCount: number;
    deepClientReferenceCount: number;
    deepCommonReferenceCount: number;
    deepServerReferenceCount: number;
    rootClientReferenceSamples: string[];
    rootCommonReferenceSamples: string[];
    rootServerReferenceSamples: string[];
    deepClientReferenceSamples: string[];
}

export interface ClientSignatureIndex {
    analyzedClassCount: number;
    rootClassNames: string[];
    clientApiExtendsCount: number;
    clientApiImplementsCount: number;
    clientMethodSignatureCount: number;
    clientFieldSignatureCount: number;
    forgeClientEventHitCount: number;
    serviceClientAdapterCount: number;
    mixinClientTargetCount: number;
    clientBootstrapPatternCount: number;
    signatureKinds: string[];
    evidenceSamples: string[];
}

export interface ArchiveIndex {
    entryCount: number;
    classEntryCount: number;
    assetEntryCount: number;
    mixinConfigCount: number;
    clientReferenceCount: number;
    hasClientCodeReferences: boolean;
    hintCategories: ArchiveHintCategory[];
    sampleEntries: string[];
    bytecode: BytecodeReachabilityIndex | null;
    clientSignatures: ClientSignatureIndex | null;
}

export interface ModDescriptor {
    fileName: string;
    filePath: string;
    fileSize: number | null;
    fileSha256: string | null;
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
    archiveIndex: ArchiveIndex | null;
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
    archiveIndex?: ArchiveIndex | null;
    parsingWarnings?: MetadataWarning[];
    parsingErrors?: MetadataError[];
}

export interface DescriptorSummary {
    fileName: string;
    loader: LoaderKind;
    modIds: string[];
    displayName: string | null;
    version: string | null;
    fileSha256: string | null;
    declaredSide: SideHint;
    metadataFilesFound: string[];
    dependencies: number;
    optionalDependencies: number;
    incompatibilities: number;
    archiveIndex?: ArchiveIndex | null;
    parsingWarnings: number;
    parsingErrors: number;
}
