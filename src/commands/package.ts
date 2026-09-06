import { Command } from "commander";
import {
    createPackagePipelinePlan,
    executePackagePipeline,
    type PackageFormat,
} from "../core/packagePipeline.js";

function parseFormat(value: string): PackageFormat[] | undefined {
    if (value === "all") return undefined;
    if (value === "deb" || value === "rpm") return [value];
    throw new Error(`Unsupported package format: ${value}`);
}

function printPlan(rootDir: string, format: string): void {
    const plan = createPackagePipelinePlan(rootDir, parseFormat(format));
    console.log("Package Pipeline Plan");
    console.log("");
    console.log(`Application: ${plan.applicationName}`);
    console.log(`Artifact root: ${plan.artifactRoot}`);
    console.log(`Stager manifest: ${plan.stagerManifest}`);
    console.log(`Stager target: ${plan.stagerTarget}`);
    console.log(`Staged root: ${plan.stagedRoot}`);
    console.log(`Embark manifest: ${plan.embarkManifest}`);
    console.log(`Formats: ${plan.formats.join(", ")}`);
    console.log(`Package output: ${plan.packageOutputRoot}`);
}

export function registerPackageCommand(program: Command): void {
    const packageCommand = program
        .command("package")
        .description("Orchestrate build, staging, and native packaging");

    const planCommand = packageCommand
        .command("plan", { isDefault: true })
        .description("Print the package pipeline plan")
        .option("--format <format>", "Package format: deb, rpm, or all", "all");

    planCommand.action(() => {
        const options = planCommand.opts<{ format: string }>();
        printPlan(process.cwd(), options.format);
    });

    const buildCommand = packageCommand
        .command("build")
        .description("Build, stage, and create native packages")
        .option("--format <format>", "Package format: deb, rpm, or all", "all")
        .option("--skip-build", "Reuse current build outputs and only repackage");

    buildCommand.action(() => {
            const options = buildCommand.opts<{ format: string; skipBuild?: boolean }>();
            try {
                console.log("Package Pipeline");
                console.log("");
                const plan = executePackagePipeline(process.cwd(), {
                    formats: parseFormat(options.format),
                    skipBuild: options.skipBuild ?? false,
                });
                console.log("");
                console.log(`Package result: succeeded (${plan.formats.join(", ")})`);
            } catch (error) {
                console.error("");
                console.error(`Package result: failed`);
                console.error(`Reason: ${(error as Error).message}`);
                process.exitCode = 1;
            }
        });
}
