import { Command } from "commander";

import { upsertComponent, upsertVersionLane } from "../core/components.js";
import {
    readCaptainProject,
    writeCaptainProject,
} from "../core/manifest.js";
import {
    formatScanSuggestions,
    scanProject,
} from "../core/scanner.js";
import { syncGeneratedManifests } from "../core/sync.js";

export function registerScanCommand(program: Command): void {
    program
        .command("scan")
        .description("Scan project structure and suggest components")
        .option("--apply", "Apply detected suggestions")
        .option("--force", "Overwrite existing lanes/components when applying")
        .option("--version <version>", "Initial version for newly detected lanes", "1.0.0")
        .option("--no-generate", "Do not regenerate derived manifest files after applying")
        .action(async (options) => {
            const rootDir = process.cwd();
            const suggestions = await scanProject(rootDir);

            console.log(formatScanSuggestions(suggestions));

            if (!options.apply) {
                if (suggestions.length > 0) {
                    console.log("");
                    console.log("Run with --apply to add these lanes/components.");
                }

                return;
            }

            if (suggestions.length === 0) {
                return;
            }

            const project = await readCaptainProject(rootDir);

            let lanesAdded = 0;
            let lanesSkipped = 0;
            let componentsAdded = 0;
            let componentsSkipped = 0;

            for (const suggestion of suggestions) {
                const laneChanged = upsertVersionLane(project, {
                    name: suggestion.laneName,
                    type: suggestion.laneType,
                    version: options.version,
                    force: options.force,
                });

                if (laneChanged) {
                    lanesAdded += 1;
                } else {
                    lanesSkipped += 1;
                }

                const componentChanged = upsertComponent(
                    project,
                    {
                        name: suggestion.name,
                        type: suggestion.componentType,
                        path: suggestion.path,
                        versionLane: suggestion.laneName,
                    },
                    options.force,
                );

                if (componentChanged) {
                    componentsAdded += 1;
                } else {
                    componentsSkipped += 1;
                }
            }

            await writeCaptainProject(rootDir, project);

            console.log("");
            console.log("Captain scan applied:");
            console.log(`- lanes added/updated:      ${lanesAdded}`);
            console.log(`- lanes skipped:            ${lanesSkipped}`);
            console.log(`- components added/updated: ${componentsAdded}`);
            console.log(`- components skipped:       ${componentsSkipped}`);

            if (options.generate) {
                await syncGeneratedManifests(rootDir);
                console.log("");
                console.log("Generated manifest files updated.");
            }
        });
}