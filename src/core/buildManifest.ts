import { resolveToolConfig } from "./toolManifest.js";
import type { CaptainBuildManifest } from "../types/build.js";

export async function readBuildManifest(
    rootDir: string
): Promise<CaptainBuildManifest> {
    const resolved = await resolveToolConfig<CaptainBuildManifest>(rootDir, "build", { required: true });
    const manifest = resolved!.config;

    validateBuildManifest(manifest);
    return manifest;
}

function validateExecution(name: string, build: CaptainBuildManifest["build"]): void {
    if (!build || !Array.isArray(build.commands)) {
        throw new Error(`${name}.commands must be an array`);
    }
    if (!Array.isArray(build.outputs)) {
        throw new Error(`${name}.outputs must be an array`);
    }
}

function validatePackage(name: string, packageConfig: CaptainBuildManifest["package"]): void {
    if (!packageConfig || !Array.isArray(packageConfig.include)) {
        throw new Error(`${name}.include must be an array`);
    }
}

function validateBuildManifest(
    manifest: CaptainBuildManifest
): void {
    if (
        manifest.schema !== "captain/build/v0.1" &&
        manifest.schema !== "captain/build/v0.2"
    ) {
        throw new Error(
            `Unsupported build manifest schema: ${manifest.schema}`
        );
    }

    if (!manifest.application?.name) {
        throw new Error("Build manifest application.name is required");
    }

    if (manifest.schema === "captain/build/v0.1") {
        validateExecution("Build manifest build", manifest.build);
        validatePackage("Build manifest package", manifest.package);
        return;
    }

    if (!manifest.targets || typeof manifest.targets !== "object" || Array.isArray(manifest.targets)) {
        throw new Error("Build manifest targets must be an object");
    }

    const targetNames = Object.keys(manifest.targets);
    if (targetNames.length === 0) {
        throw new Error("Build manifest targets must contain at least one target");
    }

    if (manifest.defaultTarget && !manifest.targets[manifest.defaultTarget]) {
        throw new Error(`Build manifest defaultTarget '${manifest.defaultTarget}' does not exist`);
    }

    for (const [targetName, target] of Object.entries(manifest.targets)) {
        validateExecution(`Build target '${targetName}' build`, target.build);
        validatePackage(`Build target '${targetName}' package`, target.package);
    }
}
