import { Command } from "commander";

import {
    getBumpRulesPath,
    getMasterManifestPath,
} from "../core/manifest.js";
import { syncGeneratedManifests } from "../core/sync.js";

export function registerGenerateCommand(program: Command): void {
    program
        .command("generate")
        .description("Generate master manifest and bump rules")
        .action(async () => {
            const rootDir = process.cwd();

            await syncGeneratedManifests(rootDir);

            console.log("Captain generated manifest files:");
            console.log(`- ${getMasterManifestPath(rootDir)}`);
            console.log(`- ${getBumpRulesPath(rootDir)}`);
        });
}