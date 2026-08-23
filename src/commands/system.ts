import {
    Command
} from "commander";

import path from "node:path";

import {
    readCaptainProject
} from "../core/manifest.js";

import {
    getOutfitStatus
} from "../core/outfit.js";

export function registerSystemCommand(
    program: Command
): void {
    const system =
        program
            .command("system")
            .description(
                "Manage project system dependencies through Outfit"
            );

    system
        .command("status")
        .description(
            "Check system dependency state"
        )
        .option(
            "--registry <path>",
            "Outfit registry path",
            "../captain-outfit-registry"
        )
        .action(
            async (
                options: {
                    registry: string;
                }
            ) => {
                const rootDir =
                    process.cwd();

                const project =
                    await readCaptainProject(
                        rootDir
                    );

                const requirements =
                    project.system
                        ?.requires ??
                    [];

                if (
                    requirements.length ===
                    0
                ) {
                    console.log(
                        "No system dependencies declared."
                    );

                    return;
                }

                const registryPath =
                    path.resolve(
                        rootDir,
                        options.registry
                    );

                const status =
                    getOutfitStatus(
                        rootDir,
                        requirements,
                        registryPath
                    );

                console.log(
                    "System Dependencies"
                );

                console.log("");

                console.log(
                    `Provider: Outfit`
                );

                console.log(
                    `Registry: ${registryPath}`
                );

                console.log("");

                const plan =
                    status.response
                        .result
                        ?.plan;

                for (
                    const requirement
                    of plan?.requirements ??
                []
                    ) {
                    console.log(
                        `- ${
                            requirement
                                .resolution
                                .requirement
                        }`
                    );

                    console.log(
                        `  Package: ${
                            requirement
                                .resolution
                                .package
                        }`
                    );

                    console.log(
                        `  Source: ${
                            requirement
                                .resolution
                                .source
                        }`
                    );
                }

                console.log("");

                console.log(
                    status.satisfied
                        ? "System state: satisfied"
                        : `System state: ${status.pendingChanges} change(s) pending`
                );
            }
        );
}