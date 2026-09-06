import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { readBuildManifest } from "./buildManifest.js";
import { packageBuild } from "./buildPackager.js";
import { runBuild } from "./buildRunner.js";
import type { CaptainProject, CaptainPackagingConfig } from "../types/manifest.js";

export type PackageFormat = "deb" | "rpm";

export interface PackagePipelinePlan {
    applicationName: string;
    artifactRoot: string;
    stagedRoot: string;
    stagerManifest: string;
    stagerTarget: string;
    embarkManifest: string;
    packageOutputRoot: string;
    formats: PackageFormat[];
}

export interface PackagePipelineOptions {
    formats?: PackageFormat[];
    skipBuild?: boolean;
}

function readProject(rootDir: string): CaptainProject {
    const projectPath = path.join(rootDir, "manifest", "captain.project.json");
    if (!fs.existsSync(projectPath)) {
        throw new Error(`Captain project manifest not found: ${projectPath}`);
    }
    return JSON.parse(fs.readFileSync(projectPath, "utf8")) as CaptainProject;
}

function requirePackaging(project: CaptainProject): CaptainPackagingConfig {
    if (!project.packaging) {
        throw new Error("captain.project.json is missing packaging configuration");
    }
    if (!project.packaging.stager?.manifest || !project.packaging.stager?.target) {
        throw new Error("packaging.stager.manifest and packaging.stager.target are required");
    }
    if (!project.packaging.embark?.manifest || !Array.isArray(project.packaging.embark.formats)) {
        throw new Error("packaging.embark.manifest and packaging.embark.formats are required");
    }
    return project.packaging;
}

function assertInsideProject(rootDir: string, relativePath: string, label: string): string {
    if (path.isAbsolute(relativePath)) {
        throw new Error(`${label} must be project-relative: ${relativePath}`);
    }
    const projectRoot = path.resolve(rootDir);
    const resolved = path.resolve(projectRoot, relativePath);
    const relative = path.relative(projectRoot, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error(`${label} escapes the project root: ${relativePath}`);
    }
    return resolved;
}

function selectFormats(configured: string[], requested?: PackageFormat[]): PackageFormat[] {
    const supported = new Set<PackageFormat>(["deb", "rpm"]);
    const normalized = configured.filter((value): value is PackageFormat => supported.has(value as PackageFormat));
    if (normalized.length !== configured.length) {
        const unsupported = configured.filter(value => !supported.has(value as PackageFormat));
        throw new Error(`Unsupported package format(s): ${unsupported.join(", ")}`);
    }
    if (!requested || requested.length === 0) {
        return normalized;
    }
    for (const format of requested) {
        if (!normalized.includes(format)) {
            throw new Error(`Package format is not enabled for this project: ${format}`);
        }
    }
    return requested;
}

export function createPackagePipelinePlan(rootDir: string, requestedFormats?: PackageFormat[]): PackagePipelinePlan {
    const project = readProject(rootDir);
    const packaging = requirePackaging(project);
    const buildManifest = readBuildManifest(rootDir);
    const artifactRoot = path.resolve(
        rootDir,
        buildManifest.package.output.directory,
        buildManifest.package.name,
    );
    const stagedRoot = path.resolve(
        rootDir,
        packaging.stagingRoot ?? `.captain/staged/${packaging.stager.target}/${buildManifest.package.name}`,
    );
    const packageOutputRoot = path.resolve(rootDir, packaging.outputRoot ?? ".captain/packages");

    return {
        applicationName: buildManifest.application.name,
        artifactRoot,
        stagedRoot,
        stagerManifest: assertInsideProject(rootDir, packaging.stager.manifest, "Stager manifest"),
        stagerTarget: packaging.stager.target,
        embarkManifest: assertInsideProject(rootDir, packaging.embark.manifest, "Embark manifest"),
        packageOutputRoot,
        formats: selectFormats(packaging.embark.formats, requestedFormats),
    };
}

function commandPrefix(envName: string, fallback: string): string[] {
    const raw = process.env[envName];
    if (!raw) return [fallback];
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some(value => typeof value !== "string" || value.length === 0)) {
            throw new Error("expected a non-empty JSON string array");
        }
        return parsed;
    } catch (error) {
        throw new Error(`${envName} must be a JSON string array, for example [\"node\",\"/path/to/cli.js\"]: ${(error as Error).message}`);
    }
}

function runTool(prefix: string[], args: string[], cwd: string, label: string): void {
    const [command, ...baseArgs] = prefix;
    const result = spawnSync(command, [...baseArgs, ...args], {
        cwd,
        stdio: "inherit",
        env: process.env,
    });
    if (result.error) {
        throw new Error(`${label} could not start: ${result.error.message}`);
    }
    if (result.status !== 0) {
        throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}`);
    }
}

export function executePackagePipeline(rootDir: string, options: PackagePipelineOptions = {}): PackagePipelinePlan {
    const plan = createPackagePipelinePlan(rootDir, options.formats);
    const buildManifest = readBuildManifest(rootDir);

    if (!options.skipBuild) {
        const buildResult = runBuild(rootDir, buildManifest);
        if (buildResult.failedCommand) {
            throw new Error(`Build failed: ${buildResult.failedCommand}`);
        }
        if (buildResult.missingOutputs.length > 0) {
            throw new Error(`Build completed with missing outputs: ${buildResult.missingOutputs.join(", ")}`);
        }
    }

    const artifact = packageBuild(rootDir, buildManifest);
    if (!artifact.success) {
        throw new Error(`Artifact packaging failed; missing entries: ${artifact.missingEntries.join(", ")}`);
    }

    fs.rmSync(plan.stagedRoot, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(plan.stagedRoot), { recursive: true });

    runTool(
        commandPrefix("CAPTAIN_STAGER_COMMAND", "stager"),
        [
            "apply",
            plan.stagerManifest,
            "--target", plan.stagerTarget,
            "--source-root", plan.artifactRoot,
            "--root", plan.stagedRoot,
            "--force",
        ],
        rootDir,
        "Stager",
    );

    for (const format of plan.formats) {
        const output = path.join(plan.packageOutputRoot, format);
        fs.mkdirSync(output, { recursive: true });
        runTool(
            commandPrefix("CAPTAIN_EMBARK_COMMAND", "embark"),
            [
                format,
                "build",
                "--staged", plan.stagedRoot,
                "--package", plan.embarkManifest,
                "--output", output,
            ],
            rootDir,
            `Embark ${format}`,
        );
    }

    return plan;
}
