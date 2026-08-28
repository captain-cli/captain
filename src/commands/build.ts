import {
    Command
} from "commander";

import {
    readBuildManifest
} from "../core/buildManifest.js";

export function registerBuildCommand(
    program: Command
): void {
    program
        .command("build")
        .description(
            "Plan the project build"
        )
        .action(
            () => {
                const rootDir =
                    process.cwd();

                const manifest =
                    readBuildManifest(
                        rootDir
                    );

                console.log(
                    "Build Plan"
                );

                console.log("");

                console.log(
                    `Application: ${manifest.application.name}`
                );

                console.log(
                    `Type: ${manifest.application.type}`
                );

                console.log(
                    `Language: ${manifest.application.language}`
                );

                if (
                    manifest.application.standard
                ) {
                    console.log(
                        `Standard: ${manifest.application.standard}`
                    );
                }

                console.log("");

                console.log(
                    "Commands:"
                );

                for (
                    const command
                    of manifest.build.commands
                ) {
                    console.log(
                        `- ${command}`
                    );
                }

                console.log("");

                console.log(
                    "Expected outputs:"
                );

                for (
                    const output
                    of manifest.build.outputs
                ) {
                    console.log(
                        `- ${output}`
                    );
                }

                console.log("");

                console.log(
                    "Vendor dependencies:"
                );

                for (
                    const dependency
                    of manifest.vendor
                ) {
                    console.log(
                        `- ${dependency.name} (${dependency.type})`
                    );

                    console.log(
                        `  Required at: ${dependency.requiredAt.join(", ")}`
                    );
                }

                console.log("");

                console.log(
                    "Package contents:"
                );

                for (
                    const entry
                    of manifest.package.include
                ) {
                    console.log(
                        `- ${entry}`
                    );
                }

                console.log("");

                console.log(
                    `Artifact directory: ${manifest.package.output.directory}`
                );
            }
        );
}
