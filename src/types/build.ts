export interface CaptainBuildApplication {
    name: string;
    type: string;
    language: string;
    standard?: string;
}

export interface CaptainBuildVendorDependency {
    name: string;
    type: string;
    requiredAt: string[];
}

export interface CaptainBuildEnvironmentVariable {
    name: string;
    required: boolean;
    default?: string;
}

export interface CaptainBuildEnvironment {
    build: CaptainBuildEnvironmentVariable[];
    runtime: CaptainBuildEnvironmentVariable[];
}

export interface CaptainBuildConfigEntry {
    source: string;
    required: boolean;
}

export interface CaptainBuildConfig {
    runtime: CaptainBuildConfigEntry[];
}

export interface CaptainBuildExecution {
    workingDirectory: string;
    commands: string[];
    outputs: string[];
}

export interface CaptainBuildPackageOutput {
    directory: string;
}

export interface CaptainBuildPackage {
    name: string;
    include: string[];
    output: CaptainBuildPackageOutput;
}

export interface CaptainBuildTarget {
    build: CaptainBuildExecution;
    package: CaptainBuildPackage;
}

export interface CaptainBuildManifest {
    schema: string;
    application: CaptainBuildApplication;
    vendor: CaptainBuildVendorDependency[];
    environment: CaptainBuildEnvironment;
    config: CaptainBuildConfig;

    /** captain/build/v0.1 single-build form. */
    build?: CaptainBuildExecution;
    package?: CaptainBuildPackage;

    /** captain/build/v0.2 named-target form. */
    defaultTarget?: string;
    targets?: Record<string, CaptainBuildTarget>;
}

export interface CaptainBuildVendorPaths {
    build?: string[];
    runtime?: string[];
}

export interface CaptainBuildVendorDependency {
    name: string;
    type: string;
    requiredAt: string[];
    paths?: CaptainBuildVendorPaths;
}