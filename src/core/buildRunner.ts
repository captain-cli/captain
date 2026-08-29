import fs from "node:fs";
import path from "node:path";
import {
    spawnSync
} from "node:child_process";

import {
    CaptainBuildManifest
} from "../types/build.js";

export interface BuildRunResult {
    success: boolean;
    failedCommand?: string;
    missingOutputs: string[];
}

export function runBuild(
    rootDir: string,
    manifest: CaptainBuildManifest
): BuildRunResult {
    const workingDirectory =
        path.resolve(
            rootDir,
            manifest.build.workingDirectory
        );

    console.log(
        `Working directory: ${workingDirectory}`
    );

    console.log("");

    for (
        const command
        of manifest.build.commands
        ) {
        console.log(
            `> ${command}`
        );

        const result =
            spawnSync(
                command,
                {
                    cwd: workingDirectory,
                    shell: true,
                    stdio: "inherit"
                }
            );

        if (
            result.error
        ) {
            console.error(
                `Failed to start command: ${command}`
            );

            console.error(
                result.error.message
            );

            return {
                success: false,
                failedCommand: command,
                missingOutputs: []
            };
        }

        if (
            result.status !== 0
        ) {
            console.error("");

            console.error(
                `Build command failed with exit code ${result.status}`
            );

            return {
                success: false,
                failedCommand: command,
                missingOutputs: []
            };
        }

        console.log("");
    }

    const missingOutputs =
        manifest.build.outputs.filter(
            output =>
                !fs.existsSync(
                    path.resolve(
                        workingDirectory,
                        output
                    )
                )
        );

    return {
        success:
            missingOutputs.length === 0,
        missingOutputs
    };
}