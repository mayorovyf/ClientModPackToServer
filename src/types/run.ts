import type {
    ArbiterProfile,
    DeepCheckMode,
    DependencyValidationMode,
    OutputPolicy,
    RegistryMode,
    RunMode,
    ValidationMode,
    ProbeMode
} from './config';
import type { InstanceInputKind, InstanceSource } from './intake';
import type { PackRuntimeDetection } from './runtime-detection';
import type { JavaProfileId, RuntimeTopologyId } from './topology';

export interface RunPaths {
    inputPath: string;
    instancePath: string;
    modsPath: string;
    outputRootDir: string;
    reportRootDir: string;
    tmpRootDir: string;
    buildDir: string;
    buildModsDir: string;
    buildInternalDir: string;
    workspaceManifestPath: string;
    workspaceStashDir: string;
    workspaceStashModsDir: string;
    workspaceCoreCacheDir: string;
    validationSandboxRootDir: string;
    reportDir: string;
    jsonReportPath: string;
    runMetadataPath: string;
    summaryPath: string;
    eventsLogPath: string;
    recipePath: string;
    candidatesPath: string;
}

export interface RunContext extends RunPaths {
    runId: string;
    runIdPrefix: string;
    serverDirName: string | null;
    startedAt: string;
    inputKind: InstanceInputKind;
    instanceSource: InstanceSource;
    dryRun: boolean;
    mode: RunMode;
    outputPolicy: OutputPolicy;
    dependencyValidationMode: DependencyValidationMode;
    arbiterProfile: ArbiterProfile;
    deepCheckMode: DeepCheckMode;
    validationMode: ValidationMode;
    validationTimeoutMs: number;
    validationEntrypointPath: string | null;
    javaProfile: JavaProfileId;
    preferredRuntimeTopologyId?: RuntimeTopologyId | null;
    validationSaveArtifacts: boolean;
    installServerCore: boolean;
    probeMode: ProbeMode;
    probeTimeoutMs: number;
    probeKnowledgePath: string;
    probeMaxMods: number;
    registryMode: RegistryMode;
    registryManifestUrl: string | null;
    registryBundleUrl: string | null;
    registryCacheDir: string | null;
    localOverridesPath: string | null;
    detectedRuntime?: PackRuntimeDetection | null;
}
