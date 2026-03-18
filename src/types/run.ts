import type {
    ArbiterProfile,
    DeepCheckMode,
    DependencyValidationMode,
    OutputPolicy,
    RegistryMode,
    RunMode,
    ValidationMode
} from './config';

export interface RunPaths {
    inputPath: string;
    outputRootDir: string;
    reportRootDir: string;
    tmpRootDir: string;
    buildDir: string;
    buildModsDir: string;
    reportDir: string;
    jsonReportPath: string;
    runMetadataPath: string;
    summaryPath: string;
    eventsLogPath: string;
}

export interface RunContext extends RunPaths {
    runId: string;
    runIdPrefix: string;
    startedAt: string;
    dryRun: boolean;
    mode: RunMode;
    outputPolicy: OutputPolicy;
    dependencyValidationMode: DependencyValidationMode;
    arbiterProfile: ArbiterProfile;
    deepCheckMode: DeepCheckMode;
    validationMode: ValidationMode;
    validationTimeoutMs: number;
    validationEntrypointPath: string | null;
    validationSaveArtifacts: boolean;
    registryMode: RegistryMode;
    registryManifestUrl: string | null;
    registryBundleUrl: string | null;
    registryCacheDir: string | null;
    localOverridesPath: string | null;
}
