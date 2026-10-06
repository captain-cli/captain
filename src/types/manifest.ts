export type ProjectType = "monolith" | "monorepo" | "package" | "application";

export interface CaptainSystemRequirements {
    requires: string[];
}


export interface CaptainPublishDestination {
    provider: string;
    repository?: string;
    tag?: string;
    releaseName?: string;
    draft?: boolean;
    prerelease?: boolean;
    generateReleaseNotes?: boolean;
    [key: string]: unknown;
}

export interface CaptainGitHubReleaseDestination extends CaptainPublishDestination {
    provider: "github-release";
    repository: string;
}

export interface CaptainPublishConfig {
    destinations: Record<string, CaptainPublishDestination>;
}

export interface CaptainEcosystemSection {
    [key: string]: unknown;
}

export interface CaptainStagerConfig extends CaptainEcosystemSection {
    /** Default Stager target selected by Captain native packaging. */
    target?: string;
}

export interface CaptainEmbarkConfig extends CaptainEcosystemSection {
    /** Native package formats enabled for this project. */
    formats?: string[];
}

export interface CaptainProject {
    schema: string;
    project: {
        name: string;
        type: ProjectType | string;
        version: string;
        homePage?: string;
    };

    system?: CaptainSystemRequirements;
    publish?: CaptainPublishConfig;
    build?: import("./build.js").CaptainBuildManifest;
    stager?: CaptainStagerConfig;
    embark?: CaptainEmbarkConfig;
    dockhand?: CaptainEcosystemSection;
    servicewright?: CaptainEcosystemSection;

    /** Captain-owned split manifest references, relative to the project root. */
    manifests?: Record<string, string>;


    versionLanes: Record<
        string,
        CaptainVersionLane
    >;

    components: CaptainComponent[];
}

export interface CaptainVersionLane {
    type: string;
    version: string;
}

export interface CaptainComponent {
    name: string;
    type: string;
    path: string;
    versionLane: string;
}

export interface MasterManifest {
    name: string;
    version: string;
    "home-page"?: string;
    components: Record<string, { version: string }>;
}

export interface BumpRules {
    schema: string;
    defaultBump: "patch" | "minor" | "major";
    lanes: Record<string, BumpRuleLane>;
}

export interface BumpRuleLane {
    type: string;
    versionPath: string;
    paths: string[];
}
