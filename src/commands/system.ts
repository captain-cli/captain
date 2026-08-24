import {
    Command
} from "commander";

import path from "node:path";

import {
    readCaptainProject
} from "../core/manifest.js";

import {
    applyOutfitSystem,
    approveOutfitSystem,
    getOutfitStatus,
    planOutfitSystem
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

    system
        .command("plan")
        .description(
            "Create a system dependency plan through Outfit"
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

                const response =
                    planOutfitSystem(
                        rootDir,
                        requirements,
                        registryPath
                    );

                const plan =
                    response.result
                        ?.plan;

                const changes =
                    plan
                        ?.transaction
                        ?.changes ??
                    [];

                console.log(
                    "System Dependency Plan"
                );

                console.log("");

                console.log(
                    `Provider: Outfit`
                );

                console.log(
                    `Registry: ${registryPath}`
                );

                console.log("");

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
                    changes.length === 0
                        ? "Plan state: satisfied"
                        : `Plan state: ${changes.length} change(s) pending`
                );

                console.log("");

                console.log(
                    "Plan artifact:"
                );

                console.log(
                    "  .captain/outfit/plan.json"
                );
            }
        );

    system
        .command("approve")
        .description(
            "Approve the current Outfit system dependency plan"
        )
        .action(
            async () => {
                const rootDir =
                    process.cwd();

                const response =
                    approveOutfitSystem(
                        rootDir
                    );

                const approval =
                    response.result
                        ?.approval;

                console.log(
                    "System Dependency Approval"
                );

                console.log("");

                console.log(
                    "Provider: Outfit"
                );

                if (approval) {
                    console.log(
                        `Plan ID: ${approval.planId}`
                    );

                    console.log(
                        `Fingerprint: ${approval.fingerprint.value}`
                    );
                }

                console.log("");

                console.log(
                    "Approval artifact:"
                );

                console.log(
                    "  .captain/outfit/approval.json"
                );
            }
        );

    system
        .command("apply")
        .description(
            "Apply the approved system dependency plan through Outfit"
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

                const registryPath =
                    path.resolve(
                        rootDir,
                        options.registry
                    );

                const response =
                    applyOutfitSystem(
                        rootDir,
                        registryPath
                    );

                if (
                    response.status ===
                    "satisfied"
                ) {
                    console.log(
                        "System dependencies are already satisfied."
                    );

                    console.log("");

                    console.log(
                        "No changes were required."
                    );
                } else if (
                    response.status ===
                    "success"
                ) {
                    console.log(
                        "System dependencies applied successfully."
                    );
                } else {
                    console.error(
                        "System dependency apply failed."
                    );

                    if (
                        response.error
                            ?.message
                    ) {
                        console.error("");

                        console.error(
                            `Reason:\n  ${response.error.message}`
                        );
                    }
                }

                if (
                    response.receiptPath
                ) {
                    console.log("");

                    console.log(
                        "Outfit receipt:"
                    );

                    console.log(
                        `  ${response.receiptPath}`
                    );
                }

                if (
                    response.status ===
                    "failed"
                ) {
                    process.exitCode = 1;
                }
            }
        );
}