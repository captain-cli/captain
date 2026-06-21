import { Command } from "commander";

import { validateCaptainProject } from "../core/validator.js";

export function registerValidateCommand(program: Command): void {
    program
        .command("validate")
        .description("Validate Captain manifest files")
        .action(async () => {
            const rootDir = process.cwd();
            const result = await validateCaptainProject(rootDir);

            if (result.warnings.length > 0) {
                console.log("Warnings:");
                for (const warning of result.warnings) {
                    console.log(`- ${warning}`);
                }
                console.log("");
            }

            if (!result.valid) {
                console.error("Captain manifest validation failed:");

                for (const error of result.errors) {
                    console.error(`- ${error}`);
                }

                process.exitCode = 1;
                return;
            }

            console.log("Captain manifest validation passed.");
        });
}