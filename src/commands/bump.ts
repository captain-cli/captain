import { Command } from "commander";

import {
    applyBumpPlan,
    applySingleBump,
    readBumpPlan,
} from "../core/bumper.js";

export function registerBumpCommand(program: Command): void {
    program
        .command("bump")
        .description("Apply version bumps")
        .argument("[lane]", "Version lane to bump")
        .argument("[level]", "Bump level: patch, minor, or major")
        .option("--plan <plan>", "Apply bumps from a bump plan JSON file")
        .action(async (lane, level, options) => {
            const rootDir = process.cwd();

            if (options.plan) {
                const plan = await readBumpPlan(options.plan);
                const result = await applyBumpPlan({ rootDir, plan });

                if (!result.bumped) {
                    console.log("No version bumps applied.");
                    return;
                }

                console.log("Captain applied version bumps:");

                for (const [laneName, update] of Object.entries(result.updates)) {
                    console.log(`- ${laneName}: ${update.from} -> ${update.to} (${update.level})`);
                }

                return;
            }

            if (!lane || !level) {
                console.error("Provide a lane and bump level, or use --plan <path>.");
                console.error("Examples:");
                console.error("  captain bump apis patch");
                console.error("  captain bump --plan .captain/bump-plan.json");
                process.exitCode = 1;
                return;
            }

            const result = await applySingleBump({
                rootDir,
                laneName: lane,
                level,
            });

            console.log("Captain applied version bump:");

            for (const [laneName, update] of Object.entries(result.updates)) {
                console.log(`- ${laneName}: ${update.from} -> ${update.to} (${update.level})`);
            }
        });
}