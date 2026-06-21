import { Command } from "commander";

import {
    readCaptainProject,
    writeCaptainProject,
} from "../core/manifest.js";

export function registerLaneCommand(program: Command): void {
    const lane = program
        .command("lane")
        .description("Manage version lanes");

    lane
        .command("add <name>")
        .description("Add a version lane")
        .requiredOption("--type <type>", "Version lane type")
        .option("--version <version>", "Initial lane version", "1.0.0")
        .option("--force", "Overwrite an existing version lane")
        .action(async (name, options) => {
            const rootDir = process.cwd();
            const project = await readCaptainProject(rootDir);

            if (project.versionLanes[name] && !options.force) {
                console.error(`Version lane already exists: ${name}`);
                console.error("Use --force to overwrite it.");
                process.exitCode = 1;
                return;
            }

            project.versionLanes[name] = {
                type: options.type,
                version: options.version,
            };

            await writeCaptainProject(rootDir, project);

            console.log(`Version lane added: ${name}`);
        });

    lane
        .command("list")
        .description("List version lanes")
        .action(async () => {
            const rootDir = process.cwd();
            const project = await readCaptainProject(rootDir);

            const laneNames = Object.keys(project.versionLanes);

            if (laneNames.length === 0) {
                console.log("No version lanes defined.");
                return;
            }

            for (const laneName of laneNames) {
                const laneConfig = project.versionLanes[laneName];
                console.log(`${laneName} (${laneConfig.type}) ${laneConfig.version}`);
            }
        });
}