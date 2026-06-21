import { fileExists } from "./files.js";
import {
    createBumpRulesFromProject,
    createMasterManifestFromProject,
    getBumpRulesPath,
    getCaptainProjectPath,
    getMasterManifestPath,
    readCaptainProject,
} from "./manifest.js";
import { readJsonFile } from "./files.js";

import type {
    BumpRules,
    CaptainProject,
    MasterManifest,
} from "../types/manifest.js";

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

function isValidVersion(value: string): boolean {
    return /^\d+\.\d+\.\d+$/.test(value);
}

function normalizeJson(value: unknown): string {
    return JSON.stringify(value, null, 2);
}

function assertSameJson(
    label: string,
    actual: unknown,
    expected: unknown,
    errors: string[],
): void {
    if (normalizeJson(actual) !== normalizeJson(expected)) {
        errors.push(`${label} is out of sync. Run: captain generate`);
    }
}

export async function validateCaptainProject(rootDir: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const captainProjectPath = getCaptainProjectPath(rootDir);
    const masterManifestPath = getMasterManifestPath(rootDir);
    const bumpRulesPath = getBumpRulesPath(rootDir);

    if (!(await fileExists(captainProjectPath))) {
        errors.push(`Missing required file: ${captainProjectPath}`);
    }

    if (!(await fileExists(masterManifestPath))) {
        errors.push(`Missing required file: ${masterManifestPath}`);
    }

    if (!(await fileExists(bumpRulesPath))) {
        errors.push(`Missing required file: ${bumpRulesPath}`);
    }

    if (errors.length > 0) {
        return {
            valid: false,
            errors,
            warnings,
        };
    }

    let project: CaptainProject;
    let masterManifest: MasterManifest;
    let bumpRules: BumpRules;

    try {
        project = await readCaptainProject(rootDir);
    } catch (error) {
        errors.push(`Unable to read captain.project.json: ${(error as Error).message}`);
        return { valid: false, errors, warnings };
    }

    try {
        masterManifest = await readJsonFile<MasterManifest>(masterManifestPath);
    } catch (error) {
        errors.push(`Unable to read master_manifest.json: ${(error as Error).message}`);
        return { valid: false, errors, warnings };
    }

    try {
        bumpRules = await readJsonFile<BumpRules>(bumpRulesPath);
    } catch (error) {
        errors.push(`Unable to read bump_rules.json: ${(error as Error).message}`);
        return { valid: false, errors, warnings };
    }

    if (!project.schema) {
        errors.push("captain.project.json is missing schema.");
    }

    if (!project.project?.name) {
        errors.push("captain.project.json is missing project.name.");
    }

    if (!project.project?.type) {
        errors.push("captain.project.json is missing project.type.");
    }

    if (!project.project?.version) {
        errors.push("captain.project.json is missing project.version.");
    } else if (!isValidVersion(project.project.version)) {
        errors.push(`Invalid project version: ${project.project.version}`);
    }

    for (const [laneName, laneConfig] of Object.entries(project.versionLanes)) {
        if (!laneConfig.type) {
            errors.push(`Version lane is missing type: ${laneName}`);
        }

        if (!laneConfig.version) {
            errors.push(`Version lane is missing version: ${laneName}`);
        } else if (!isValidVersion(laneConfig.version)) {
            errors.push(`Invalid version for lane ${laneName}: ${laneConfig.version}`);
        }
    }

    const componentNames = new Set<string>();

    for (const component of project.components) {
        if (componentNames.has(component.name)) {
            errors.push(`Duplicate component name: ${component.name}`);
        }

        componentNames.add(component.name);

        if (!component.type) {
            errors.push(`Component is missing type: ${component.name}`);
        }

        if (!component.path) {
            errors.push(`Component is missing path: ${component.name}`);
        }

        if (!component.versionLane) {
            errors.push(`Component is missing versionLane: ${component.name}`);
        } else if (!project.versionLanes[component.versionLane]) {
            errors.push(
                `Component ${component.name} references missing lane: ${component.versionLane}`,
            );
        }

        if (component.path && !(await fileExists(`${rootDir}/${component.path}`))) {
            errors.push(`Component path does not exist: ${component.name} -> ${component.path}`);
        }
    }

    const expectedMasterManifest = createMasterManifestFromProject(project);
    const expectedBumpRules = createBumpRulesFromProject(project);

    assertSameJson("master_manifest.json", masterManifest, expectedMasterManifest, errors);
    assertSameJson("bump_rules.json", bumpRules, expectedBumpRules, errors);

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}