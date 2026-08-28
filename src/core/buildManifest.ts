import fs from "node:fs";
import path from "node:path";

import {
    CaptainBuildManifest
} from "../types/build.js";

export function getBuildManifestPath(
    rootDir: string
): string {
    return path.join(
        rootDir,
        "manifest",
        "captain.build.json"
    );
}

export function readBuildManifest(
    rootDir: string
): CaptainBuildManifest {
    const manifestPath =
        getBuildManifestPath(
            rootDir
        );

    if (
        !fs.existsSync(
            manifestPath
        )
    ) {
        throw new Error(
            `Build manifest not found: ${manifestPath}`
        );
    }

    const raw =
        fs.readFileSync(
            manifestPath,
            "utf8"
        );

    const parsed =
        JSON.parse(
            raw
        ) as CaptainBuildManifest;

    validateBuildManifest(
        parsed
    );

    return parsed;
}

function validateBuildManifest(
    manifest: CaptainBuildManifest
): void {
    if (
        manifest.schema !==
        "captain/build/v0.1"
    ) {
        throw new Error(
            `Unsupported build manifest schema: ${manifest.schema}`
        );
    }

    if (
        !manifest.application?.name
    ) {
        throw new Error(
            "Build manifest application.name is required"
        );
    }

    if (
        !Array.isArray(
            manifest.build?.commands
        )
    ) {
        throw new Error(
            "Build manifest build.commands must be an array"
        );
    }

    if (
        !Array.isArray(
            manifest.build?.outputs
        )
    ) {
        throw new Error(
            "Build manifest build.outputs must be an array"
        );
    }

    if (
        !Array.isArray(
            manifest.package?.include
        )
    ) {
        throw new Error(
            "Build manifest package.include must be an array"
        );
    }
}
