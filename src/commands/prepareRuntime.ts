import { Command } from "commander";

import { prepareRuntime } from "../core/dockhand.js";

export function registerPrepareRuntimeCommand(program: Command): void {
    program
        .command("prepare-runtime")
        .description("Prepare optional runtime wiring using Dockhand when available")
        .option("--plan", "Preview runtime changes without writing files")
        .option(
            "--config <path>",
            "Dockhand config path",
            "manifest/dockhand.json",
        )
        .option(
            "--print-env",
            "When used with --plan, print env output instead of JSON",
        )
        .action(async (options: { plan?: boolean; config?: string; printEnv?: boolean }) => {
            const rootDir = process.cwd();
            const status = await prepareRuntime(rootDir, {
                plan: Boolean(options.plan),
                config: options.config,
                printEnv: Boolean(options.printEnv),
            });

            if (status !== 0) {
                process.exitCode = status;
            }
        });
}
