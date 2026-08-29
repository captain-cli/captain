import {
    Command
} from "commander";

import {
    readBuildManifest
} from "../core/buildManifest.js";

import fs from "node:fs";
import path from "node:path";

import {
    runBuild
} from "../core/buildRunner.js";

function printBuildPlan(
    rootDir: string
): void {
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

function printBuildCheck(
    rootDir: string
): void {
    const manifest =
        readBuildManifest(
            rootDir
        );

    const buildDependencies =
        manifest.vendor.filter(
            dependency =>
                dependency.requiredAt.includes(
                    "build"
                )
        );

    const runtimeOnlyDependencies =
        manifest.vendor.filter(
            dependency =>
                dependency.requiredAt.includes(
                    "runtime"
                ) &&
                !dependency.requiredAt.includes(
                    "build"
                )
        );

    let missingBuildVendorFiles =
        0;

    console.log(
        "Build Environment Check"
    );

    console.log("");

    console.log(
        `Application: ${manifest.application.name}`
    );

    console.log("");

    console.log(
        "Build manifest:"
    );

    console.log(
        "  ✓ loaded"
    );

    console.log("");

    console.log(
        "Build commands:"
    );

    for (
        const command
        of manifest.build.commands
        ) {
        console.log(
            `  ✓ ${command}`
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
            `  ✓ ${output}`
        );
    }

    console.log("");

    console.log(
        "Build-time vendor dependencies:"
    );

    if (
        buildDependencies.length ===
        0
    ) {
        console.log(
            "  ✓ none declared"
        );
    }

    for (
        const dependency
        of buildDependencies
        ) {
        const buildPaths =
            dependency.paths?.build ??
            [];

        const missingPaths =
            buildPaths.filter(
                vendorPath =>
                    !fs.existsSync(
                        path.resolve(
                            rootDir,
                            vendorPath
                        )
                    )
            );

        if (
            buildPaths.length ===
            0
        ) {
            console.log(
                `  ? ${dependency.name} (${dependency.type})`
            );

            console.log(
                "    no build paths declared"
            );

            missingBuildVendorFiles++;
            continue;
        }

        if (
            missingPaths.length ===
            0
        ) {
            console.log(
                `  ✓ ${dependency.name} (${dependency.type})`
            );

            for (
                const vendorPath
                of buildPaths
                ) {
                console.log(
                    `    ${vendorPath}`
                );
            }
        } else {
            console.log(
                `  ✗ ${dependency.name} (${dependency.type})`
            );

            for (
                const vendorPath
                of buildPaths
                ) {
                const exists =
                    fs.existsSync(
                        path.resolve(
                            rootDir,
                            vendorPath
                        )
                    );

                console.log(
                    exists
                        ? `    ✓ ${vendorPath}`
                        : `    ✗ ${vendorPath}`
                );
            }

            missingBuildVendorFiles +=
                missingPaths.length;
        }
    }

    console.log("");

    console.log(
        "Runtime-only vendor dependencies:"
    );

    if (
        runtimeOnlyDependencies.length ===
        0
    ) {
        console.log(
            "  - none declared"
        );
    } else {
        for (
            const dependency
            of runtimeOnlyDependencies
            ) {
            console.log(
                `  - ${dependency.name} (${dependency.type})`
            );
        }
    }

    console.log("");

    if (
        missingBuildVendorFiles >
        0
    ) {
        console.log(
            "Build readiness: blocked"
        );

        console.log(
            `Reason: ${missingBuildVendorFiles} required build-time vendor file(s) missing or undeclared`
        );
    } else {
        console.log(
            "Build readiness: ready"
        );
    }
}

export function registerBuildCommand(
    program: Command
): void {
    const build =
        program
            .command("build")
            .description(
                "Manage project builds"
            );

    build
        .command("plan")
        .description(
            "Print the project build plan"
        )
        .action(
            () => {
                printBuildPlan(
                    process.cwd()
                );
            }
        );

    build
        .command("check")
        .description(
            "Check project build readiness"
        )
        .action(
            () => {
                printBuildCheck(
                    process.cwd()
                );
            }
        );

    build
        .action(
            () => {
                printBuildPlan(
                    process.cwd()
                );
            }
        );

    build
        .command("run")
        .description(
            "Execute the project build"
        )
        .action(
            () => {
                executeBuild(
                    process.cwd()
                );
            }
        );
}

function executeBuild(
    rootDir: string
): void {
    const manifest =
        readBuildManifest(
            rootDir
        );

    console.log(
        "Build Run"
    );

    console.log("");

    console.log(
        `Application: ${manifest.application.name}`
    );

    console.log("");

    const result =
        runBuild(
            rootDir,
            manifest
        );

    if (
        result.failedCommand
    ) {
        console.log("");

        console.log(
            "Build result: failed"
        );

        console.log(
            `Failed command: ${result.failedCommand}`
        );

        process.exitCode =
            1;

        return;
    }

    if (
        result.missingOutputs.length >
        0
    ) {
        console.log(
            "Expected outputs:"
        );

        for (
            const output
            of manifest.build.outputs
            ) {
            const missing =
                result.missingOutputs.includes(
                    output
                );

            console.log(
                missing
                    ? `  ✗ ${output}`
                    : `  ✓ ${output}`
            );
        }

        console.log("");

        console.log(
            "Build result: failed"
        );

        console.log(
            `Reason: ${result.missingOutputs.length} expected output(s) missing`
        );

        process.exitCode =
            1;

        return;
    }

    console.log(
        "Expected outputs:"
    );

    for (
        const output
        of manifest.build.outputs
        ) {
        console.log(
            `  ✓ ${output}`
        );
    }

    console.log("");

    console.log(
        "Build result: succeeded"
    );
}