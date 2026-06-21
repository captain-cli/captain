import path from "node:path";
import { readJsonFile, writeJsonFile } from "./files.js";
import type {
    BumpRules,
    CaptainProject,
    MasterManifest,
} from "../types/manifest.js";

export const CAPTAIN_SCHEMA_VERSION = "captain/manifest/v1";
export const BUMP_RULES_SCHEMA_VERSION = "captain/bump-rules/v1";

export function getManifestDir(rootDir: string): string {
    return path.join(rootDir, "manifest");
}

export function getCaptainProjectPath(rootDir: string): string {
    return path.join(getManifestDir(rootDir), "captain.project.json");
}

export function getMasterManifestPath(rootDir: string): string {
    return path.join(getManifestDir(rootDir), "master_manifest.json");
}

export function getBumpRulesPath(rootDir: string): string {
    return path.join(getManifestDir(rootDir), "bump_rules.json");
}

export function createCaptainProject(options: {
    name: string;
    type: string;
    version: string;
    homePage?: string;
    module?: boolean;
}): CaptainProject {
    const project: CaptainProject = {
        schema: CAPTAIN_SCHEMA_VERSION,
        project: {
            name: options.name,
            type: options.type,
            version: options.version,
            ...(options.homePage ? { homePage: options.homePage } : {}),
        },
        versionLanes: {},
        components: [],
    };

    if (options.module) {
        project.versionLanes.app = {
            type: "app",
            version: options.version,
        };

        project.components.push({
            name: "app",
            type: "app",
            path: ".",
            versionLane: "app",
        });
    }

    return project;
}

export function createMasterManifest(project: CaptainProject): MasterManifest {
    return {
        name: project.project.name,
        ...(project.project.homePage ? { "home-page": project.project.homePage } : {}),
        version: project.project.version,
        components: {},
    };
}

export function createBumpRules(): BumpRules {
    return {
        schema: BUMP_RULES_SCHEMA_VERSION,
        defaultBump: "patch",
        lanes: {},
    };
}

export async function readCaptainProject(rootDir: string): Promise<CaptainProject> {
    return readJsonFile<CaptainProject>(getCaptainProjectPath(rootDir));
}

export async function writeCaptainProject(
    rootDir: string,
    project: CaptainProject,
): Promise<void> {
    await writeJsonFile(getCaptainProjectPath(rootDir), project);
}

export function createMasterManifestFromProject(
    project: CaptainProject,
): MasterManifest {
    const components: MasterManifest["components"] = {};

    for (const [laneName, laneConfig] of Object.entries(project.versionLanes)) {
        components[laneName] = {
            version: laneConfig.version,
        };
    }

    return {
        name: project.project.name,
        ...(project.project.homePage ? { "home-page": project.project.homePage } : {}),
        version: project.project.version,
        components,
    };
}

export function createBumpRulesFromProject(project: CaptainProject): BumpRules {
    const lanes: BumpRules["lanes"] = {};

    for (const [laneName, laneConfig] of Object.entries(project.versionLanes)) {
        const laneComponents = project.components.filter(
            (componentConfig) => componentConfig.versionLane === laneName,
        );

        lanes[laneName] = {
            type: laneConfig.type,
            versionPath: `components.${laneName}.version`,
            paths: laneComponents.map((componentConfig) => {
                const cleanPath = componentConfig.path.replace(/\/+$/, "");
                return `${cleanPath}/`;
            }),
        };
    }

    return {
        schema: BUMP_RULES_SCHEMA_VERSION,
        defaultBump: "patch",
        lanes,
    };
}

export async function writeMasterManifest(
    rootDir: string,
    manifest: MasterManifest,
): Promise<void> {
    await writeJsonFile(getMasterManifestPath(rootDir), manifest);
}

export async function writeBumpRules(
    rootDir: string,
    bumpRules: BumpRules,
): Promise<void> {
    await writeJsonFile(getBumpRulesPath(rootDir), bumpRules);
}

export async function readBumpRules(rootDir: string): Promise<BumpRules> {
    return readJsonFile<BumpRules>(getBumpRulesPath(rootDir));
}