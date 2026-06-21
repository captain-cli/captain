export type ProjectType = "monolith" | "monorepo" | "package" | "application";

export interface CaptainProject {
    schema: string;
    project: {
        name: string;
        type: ProjectType | string;
        version: string;
        homePage?: string;
    };
    versionLanes: Record<string, CaptainVersionLane>;
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
