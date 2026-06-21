import { Command } from "commander";

import { validateCaptainProject } from "../core/validator.js";
import { readCaptainProject } from "../core/manifest.js";

export function registerStatusCommand(program: Command): void {
    program
        .command("status")
        .description("Show Captain project status")
        .action(async () => {
            const rootDir = process.cwd();
            const project = await readCaptainProject(rootDir);
            const validation = await validateCaptainProject(rootDir);

            console.log(`Project: ${project.project.name}`);
            console.log(`Type:    ${project.project.type}`);
            console.log(`Version: ${project.project.version}`);
            console.log("");

            const laneNames = Object.keys(project.versionLanes);

            if (laneNames.length === 0) {
                console.log("Version lanes: none");
            } else {
                console.log("Version lanes:");

                for (const laneName of laneNames) {
                    const lane = project.versionLanes[laneName];
                    console.log(`- ${laneName}: ${lane.version} (${lane.type})`);
                }
            }

            console.log("");

            if (project.components.length === 0) {
                console.log("Components: none");
            } else {
                console.log("Components:");

                for (const component of project.components) {
                    console.log(
                        `- ${component.name}: ${component.path} (${component.type}) -> ${component.versionLane}`,
                    );
                }
            }

            console.log("");
            console.log(`Validation: ${validation.valid ? "passed" : "failed"}`);

            if (!validation.valid) {
                for (const error of validation.errors) {
                    console.log(`- ${error}`);
                }

                process.exitCode = 1;
            }
        });
}