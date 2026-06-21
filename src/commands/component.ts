import { Command } from "commander";

import {
    readCaptainProject,
    writeCaptainProject,
} from "../core/manifest.js";

export function registerComponentCommand(program: Command): void {
    const component = program
        .command("component")
        .description("Manage project components");

    component
        .command("add <name>")
        .description("Add a project component")
        .requiredOption("--type <type>", "Component type")
        .requiredOption("--path <path>", "Component path")
        .requiredOption("--lane <lane>", "Version lane name")
        .option("--force", "Overwrite an existing component")
        .action(async (name, options) => {
            const rootDir = process.cwd();
            const project = await readCaptainProject(rootDir);

            if (!project.versionLanes[options.lane]) {
                console.error(`Version lane does not exist: ${options.lane}`);
                console.error(`Create it first with: captain lane add ${options.lane} --type <type>`);
                process.exitCode = 1;
                return;
            }

            const existingIndex = project.components.findIndex(
                (componentConfig) => componentConfig.name === name,
            );

            if (existingIndex >= 0 && !options.force) {
                console.error(`Component already exists: ${name}`);
                console.error("Use --force to overwrite it.");
                process.exitCode = 1;
                return;
            }

            const nextComponent = {
                name,
                type: options.type,
                path: options.path,
                versionLane: options.lane,
            };

            if (existingIndex >= 0) {
                project.components[existingIndex] = nextComponent;
            } else {
                project.components.push(nextComponent);
            }

            await writeCaptainProject(rootDir, project);

            console.log(`Component added: ${name}`);
        });

    component
        .command("list")
        .description("List project components")
        .action(async () => {
            const rootDir = process.cwd();
            const project = await readCaptainProject(rootDir);

            if (project.components.length === 0) {
                console.log("No components defined.");
                return;
            }

            for (const componentConfig of project.components) {
                console.log(
                    `${componentConfig.name} (${componentConfig.type}) ${componentConfig.path} -> ${componentConfig.versionLane}`,
                );
            }
        });
}