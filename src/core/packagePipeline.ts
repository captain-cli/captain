import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { readBuildManifest } from "./buildManifest.js";
import { packageBuild } from "./buildPackager.js";
import { runBuild } from "./buildRunner.js";
import { resolveBuildTarget } from "./buildTarget.js";
import { resolveToolConfig } from "./toolManifest.js";
import { assertSystemReady } from "./systemReadiness.js";

export type PackageFormat = "deb" | "rpm";

export interface PackagePipelinePlan {
    applicationName: string;
    artifactRoot: string;
    stagedRoot: string;
    projectRoot: string;
    stagerTarget: string;
    packageOutputRoot: string;
    formats: PackageFormat[];
}

export interface PackagePipelineOptions {
    formats?: PackageFormat[];
    skipBuild?: boolean;
}

interface PackageStagerConfig {
    target?: string;
    [key: string]: unknown;
}

interface PackageEmbarkConfig {
    formats?: string[];
    [key: string]: unknown;
}

function requireStagerTarget(config: PackageStagerConfig): string {
    if (typeof config.target !== "string" || !config.target.trim()) {
        throw new Error("stager.target is required for native packaging");
    }
    return config.target;
}

function requireEmbarkFormats(config: PackageEmbarkConfig): string[] {
    if (!Array.isArray(config.formats) || config.formats.length === 0) {
        throw new Error("embark.formats must contain at least one package format");
    }
    if (config.formats.some(format => typeof format !== "string" || !format.trim())) {
        throw new Error("embark.formats must contain only non-empty strings");
    }
    return config.formats;
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

export async function createPackagePipelinePlan(rootDir: string, requestedFormats?: PackageFormat[]): Promise<PackagePipelinePlan> {
    const stager = await resolveToolConfig<PackageStagerConfig>(rootDir, "stager", { required: true });
    const embark = await resolveToolConfig<PackageEmbarkConfig>(rootDir, "embark", { required: true });
    const stagerTarget = requireStagerTarget(stager!.config);
    const embarkFormats = requireEmbarkFormats(embark!.config);
    const buildManifest = await readBuildManifest(rootDir);
    const selectedBuild = resolveBuildTarget(buildManifest);
    const artifactRoot = path.resolve(
        rootDir,
        selectedBuild.package.output.directory,
        selectedBuild.package.name,
    );
    const stagedRoot = path.resolve(
        rootDir,
        `.captain/staged/${stagerTarget}/${selectedBuild.package.name}`,
    );
    const packageOutputRoot = path.resolve(rootDir, ".captain/packages");

    return {
        applicationName: buildManifest.application.name,
        artifactRoot,
        stagedRoot,
        projectRoot: path.resolve(rootDir),
        stagerTarget,
        packageOutputRoot,
        formats: selectFormats(embarkFormats, requestedFormats),
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

export async function executePackagePipeline(
    rootDir: string,
    options: PackagePipelineOptions = {},
): Promise<PackagePipelinePlan> {
    await assertSystemReady(rootDir);

    const plan = await createPackagePipelinePlan(rootDir, options.formats);
    const buildManifest = await readBuildManifest(rootDir);
    const selectedBuild = resolveBuildTarget(buildManifest);
    const executionManifest = { build: selectedBuild.build, package: selectedBuild.package };

    if (!options.skipBuild) {
        const buildResult = runBuild(rootDir, executionManifest);
        if (buildResult.failedCommand) {
            throw new Error(`Build failed: ${buildResult.failedCommand}`);
        }
        if (buildResult.missingOutputs.length > 0) {
            throw new Error(`Build completed with missing outputs: ${buildResult.missingOutputs.join(", ")}`);
        }
    }

    const artifact = packageBuild(rootDir, executionManifest);
    if (!artifact.success) {
        throw new Error(`Artifact packaging failed; missing entries: ${artifact.missingEntries.join(", ")}`);
    }

    fs.rmSync(plan.stagedRoot, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(plan.stagedRoot), { recursive: true });

    runTool(
        commandPrefix("CAPTAIN_STAGER_COMMAND", "stager"),
        [
            "apply",
            "--project", plan.projectRoot,
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
                "--project", plan.projectRoot,
                "--output", output,
            ],
            rootDir,
            `Embark ${format}`,
        );
    }

    return plan;
}
