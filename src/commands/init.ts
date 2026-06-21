import { Command } from "commander";

import { fileExists, writeJsonFile } from "../core/files.js";
import {
    createCaptainProject,
    getBumpRulesPath,
    getCaptainProjectPath,
    getMasterManifestPath,
    createBumpRulesFromProject,
    createMasterManifestFromProject,
} from "../core/manifest.js";

export function registerInitCommand(program: Command): void {
    program
        .command("init")
        .description("Initialize Captain's Manifest in the current project")
        .requiredOption("--name <name>", "Project name")
        .option("--type <type>", "Project type", "monolith")
        .option("--version <version>", "Initial project version", "1.0.0")
        .option("--home-page <homePage>", "Project home page")
        .option("--module", "Initialize as a single app/module project")
        .option("--force", "Overwrite existing manifest files")
        .action(async (options) => {
            const rootDir = process.cwd();

            const captainProjectPath = getCaptainProjectPath(rootDir);
            const masterManifestPath = getMasterManifestPath(rootDir);
            const bumpRulesPath = getBumpRulesPath(rootDir);

            const existingFiles = [];

            if (await fileExists(captainProjectPath)) {
                existingFiles.push(captainProjectPath);
            }

            if (await fileExists(masterManifestPath)) {
                existingFiles.push(masterManifestPath);
            }

            if (await fileExists(bumpRulesPath)) {
                existingFiles.push(bumpRulesPath);
            }

            if (existingFiles.length > 0 && !options.force) {
                console.error("Captain manifest files already exist:");
                for (const filePath of existingFiles) {
                    console.error(`- ${filePath}`);
                }
                console.error("");
                console.error("Use --force to overwrite them.");
                process.exitCode = 1;
                return;
            }

            const captainProject = createCaptainProject({
                name: options.name,
                type: options.type,
                version: options.version,
                homePage: options.homePage,
                module: options.module,
            });

            const masterManifest = createMasterManifestFromProject(captainProject);
            const bumpRules = createBumpRulesFromProject(captainProject);

            await writeJsonFile(captainProjectPath, captainProject);
            await writeJsonFile(masterManifestPath, masterManifest);
            await writeJsonFile(bumpRulesPath, bumpRules);

            console.log("Captain's Manifest initialized:");
            console.log(`- ${captainProjectPath}`);
            console.log(`- ${masterManifestPath}`);
            console.log(`- ${bumpRulesPath}`);
        });
}