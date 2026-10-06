import fs from "node:fs";
import path from "node:path";

import { getCaptainProjectPath } from "./manifest.js";

export function resolveProjectDirectory(projectDirectory?: string): string {
    const root = path.resolve(projectDirectory ?? process.cwd());
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
        throw new Error(`Captain project directory does not exist: ${root}`);
    }
    return root;
}

export function requireCaptainManifest(rootDir: string): string {
    const manifestPath = getCaptainProjectPath(rootDir);
    if (!fs.existsSync(manifestPath) || !fs.statSync(manifestPath).isFile()) {
        throw new Error(
            `Captain manifest not found in ${rootDir}. Expected ${manifestPath}`,
        );
    }
    return manifestPath;
}
