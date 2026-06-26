import path from "node:path";
import { spawnSync } from "node:child_process";

import { fileExists } from "./files.js";

export type PrepareRuntimeOptions = {
    plan?: boolean;
    config?: string;
    printEnv?: boolean;
};

export function getDockhandConfigPath(rootDir: string, configPath?: string): string {
    const effectiveConfig = configPath || "manifest/dockhand.json";

    if (path.isAbsolute(effectiveConfig)) {
        return effectiveConfig;
    }

    return path.join(rootDir, effectiveConfig);
}

export function dockhandExists(): boolean {
    const result = spawnSync("dockhand", ["--version"], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
    });

    return !result.error && result.status === 0;
}

export function printDockhandMissingHelp(configPath: string): void {
    console.error("Dockhand is not installed or is not available on PATH.");
    console.error("");
    console.error("Dockhand is optional. Install it only for projects that need runtime port/env preparation.");
    console.error("");
    console.error("Install guidance:");
    console.error("");
    console.error("  captain tools install dockhand --print");
    console.error("");
    console.error("Or install directly from the captain-cli org:");
    console.error("");
    console.error("  python -m pip install git+ssh://git@github.com/captain-cli/dockhand.git");
    console.error("Then run directly:");
    console.error("");
    console.error(`  dockhand ports plan --config ${configPath}`);
    console.error(`  dockhand ports apply --config ${configPath}`);
}

export function printDockhandConfigMissingHelp(configPath: string): void {
    console.log(`Dockhand config not found: ${configPath}`);
    console.log("");
    console.log("This project may not need Dockhand runtime preparation.");
    console.log("");
    console.log("To create a starter config:");
    console.log("");
    console.log(`  dockhand init --output ${configPath}`);
    console.log("");
    console.log("Or skip this command if the project does not need runtime port/env preparation.");
}

function runDockhand(args: string[]): number {
    const result = spawnSync("dockhand", args, {
        stdio: "inherit",
    });

    if (result.error) {
        console.error(result.error.message);
        return 1;
    }

    return result.status ?? 1;
}

export async function prepareRuntime(
    rootDir: string,
    options: PrepareRuntimeOptions,
): Promise<number> {
    const configPath = getDockhandConfigPath(rootDir, options.config);

    if (!(await fileExists(configPath))) {
        printDockhandConfigMissingHelp(options.config || "manifest/dockhand.json");
        return 0;
    }

    if (!dockhandExists()) {
        printDockhandMissingHelp(options.config || "manifest/dockhand.json");
        return 1;
    }

    const displayConfigPath = options.config || "manifest/dockhand.json";

    console.log("Validating Dockhand runtime config...");
    const validateStatus = runDockhand([
        "ports",
        "validate",
        "--config",
        displayConfigPath,
        "--json",
    ]);

    if (validateStatus !== 0) {
        return validateStatus;
    }

    const mode = options.plan ? "plan" : "apply";

    console.log("");
    console.log(`Running Dockhand ports ${mode}...`);

    const args = ["ports", mode, "--config", displayConfigPath];

    if (options.printEnv && options.plan) {
        args.push("--print-env");
    } else {
        args.push("--json");
    }

    return runDockhand(args);
}
