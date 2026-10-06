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
    return rootDir;
}

export function getCaptainProjectPath(rootDir: string): string {
    return path.join(rootDir, "manifest.json");
}

export function getMasterManifestPath(rootDir: string): string {
    return path.join(rootDir, ".captain", "generated", "master_manifest.json");
}

export function getBumpRulesPath(rootDir: string): string {
    return path.join(rootDir, ".captain", "generated", "bump_rules.json");
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

function requireObject(value: unknown, field: string): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`${field} must be an object`);
    }
    return value as Record<string, unknown>;
}

function requireNonEmptyString(value: unknown, field: string): string {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(`${field} must be a non-empty string`);
    }
    return value;
}

export function validateCaptainManifestDocument(document: unknown): asserts document is CaptainProject {
    const root = requireObject(document, "Captain manifest");

    if (root.schema !== CAPTAIN_SCHEMA_VERSION) {
        throw new Error(`Unsupported Captain manifest schema: ${String(root.schema)}. Expected ${CAPTAIN_SCHEMA_VERSION}`);
    }

    if ("packaging" in root) {
        throw new Error(
            "Deprecated manifest property packaging is no longer supported; configure first-class stager and embark sections instead",
        );
    }

    const project = requireObject(root.project, "project");
    requireNonEmptyString(project.name, "project.name");
    requireNonEmptyString(project.type, "project.type");
    requireNonEmptyString(project.version, "project.version");

    if (root.versionLanes !== undefined && (
        typeof root.versionLanes !== "object" || root.versionLanes === null || Array.isArray(root.versionLanes)
    )) {
        throw new Error("versionLanes must be an object");
    }
    if (root.components !== undefined && !Array.isArray(root.components)) {
        throw new Error("components must be an array");
    }

    // Preserve the shared Captain Core compatibility defaults. Older/minimal
    // manifests may omit release metadata sections that are unrelated to build
    // and readiness orchestration.
    if (root.versionLanes === undefined) root.versionLanes = {};
    if (root.components === undefined) root.components = [];

    if (root.manifests !== undefined) {
        const manifests = requireObject(root.manifests, "manifests");
        for (const [tool, reference] of Object.entries(manifests)) {
            requireNonEmptyString(tool, "manifests key");
            requireNonEmptyString(reference, `manifests.${tool}`);
        }
    }
}

export async function readCaptainProject(rootDir: string): Promise<CaptainProject> {
    const document = await readJsonFile<unknown>(getCaptainProjectPath(rootDir));
    validateCaptainManifestDocument(document);
    return document;
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