import fs from "node:fs";
import path from "node:path";

import {
    CaptainBuildManifest
} from "../types/build.js";

export interface BuildPackageResult {
    success: boolean;
    artifactDirectory: string;
    missingEntries: string[];
}

function copyEntry(
    sourcePath: string,
    destinationPath: string
): void {
    const stats =
        fs.statSync(
            sourcePath
        );

    if (
        stats.isDirectory()
    ) {
        fs.mkdirSync(
            destinationPath,
            {
                recursive: true
            }
        );

        for (
            const entry
            of fs.readdirSync(
            sourcePath
        )
            ) {
            copyEntry(
                path.join(
                    sourcePath,
                    entry
                ),
                path.join(
                    destinationPath,
                    entry
                )
            );
        }

        return;
    }

    fs.mkdirSync(
        path.dirname(
            destinationPath
        ),
        {
            recursive: true
        }
    );

    fs.copyFileSync(
        sourcePath,
        destinationPath
    );
}

function copyGlobEntry(
    rootDir: string,
    includeEntry: string,
    artifactRoot: string
): boolean {
    if (
        !includeEntry.endsWith(
            "/**"
        )
    ) {
        const sourcePath =
            path.resolve(
                rootDir,
                includeEntry
            );

        if (
            !fs.existsSync(
                sourcePath
            )
        ) {
            return false;
        }

        const destinationPath =
            path.resolve(
                artifactRoot,
                includeEntry
            );

        copyEntry(
            sourcePath,
            destinationPath
        );

        return true;
    }

    const baseEntry =
        includeEntry.slice(
            0,
            -3
        );

    const sourcePath =
        path.resolve(
            rootDir,
            baseEntry
        );

    if (
        !fs.existsSync(
            sourcePath
        )
    ) {
        return false;
    }

    const destinationPath =
        path.resolve(
            artifactRoot,
            baseEntry
        );

    copyEntry(
        sourcePath,
        destinationPath
    );

    return true;
}

export function packageBuild(
    rootDir: string,
    manifest: CaptainBuildManifest
): BuildPackageResult {
    const artifactDirectory =
        path.resolve(
            rootDir,
            manifest.package.output.directory,
            manifest.package.name
        );

    fs.rmSync(
        artifactDirectory,
        {
            recursive: true,
            force: true
        }
    );

    fs.mkdirSync(
        artifactDirectory,
        {
            recursive: true
        }
    );

    const missingEntries: string[] =
        [];

    for (
        const includeEntry
        of manifest.package.include
        ) {
        const copied =
            copyGlobEntry(
                rootDir,
                includeEntry,
                artifactDirectory
            );

        if (
            !copied
        ) {
            missingEntries.push(
                includeEntry
            );
        }
    }

    return {
        success:
            missingEntries.length ===
            0,
        artifactDirectory,
        missingEntries
    };
}