import type {
    CaptainBuildExecution,
    CaptainBuildManifest,
    CaptainBuildPackage,
    CaptainBuildTarget,
} from "../types/build.js";

export interface ResolvedBuildTarget {
    name?: string;
    build: CaptainBuildExecution;
    package: CaptainBuildPackage;
}

export function listBuildTargets(manifest: CaptainBuildManifest): string[] {
    return manifest.targets ? Object.keys(manifest.targets) : [];
}

export function resolveBuildTarget(
    manifest: CaptainBuildManifest,
    requestedTarget?: string,
): ResolvedBuildTarget {
    if (!manifest.targets) {
        if (requestedTarget) {
            throw new Error(
                `Build target '${requestedTarget}' was requested, but this project uses a single build configuration`,
            );
        }

        if (!manifest.build || !manifest.package) {
            throw new Error("Single build manifests require build and package configuration");
        }

        return {
            build: manifest.build,
            package: manifest.package,
        };
    }

    const targetNames = Object.keys(manifest.targets);
    if (targetNames.length === 0) {
        throw new Error("Build manifest targets must contain at least one target");
    }

    const selectedName = requestedTarget ?? manifest.defaultTarget;
    if (!selectedName) {
        throw new Error(
            `Build target is required. Available targets: ${targetNames.join(", ")}`,
        );
    }

    const target: CaptainBuildTarget | undefined = manifest.targets[selectedName];
    if (!target) {
        throw new Error(
            `Unknown build target '${selectedName}'. Available targets: ${targetNames.join(", ")}`,
        );
    }

    return {
        name: selectedName,
        build: target.build,
        package: target.package,
    };
}
