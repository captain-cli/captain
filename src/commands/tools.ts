import { Command } from "commander";

import {
    addToolManifest,
    getInstallTargets,
    installTool,
    printProjectRegistry,
    printToolDoctor,
    printToolList,
    type ToolInstallMode,
} from "../core/tools.js";

type InstallOptions = {
    print?: boolean;
    user?: boolean;
    venv?: string | boolean;
};

function resolveInstallMode(options: InstallOptions): {
    mode: ToolInstallMode;
    venvPath?: string;
} {
    if (options.user) {
        return { mode: "user" };
    }

    if (options.venv) {
        return {
            mode: "venv",
            venvPath: typeof options.venv === "string" ? options.venv : ".venv",
        };
    }

    return { mode: "print" };
}

export function registerToolsCommand(program: Command): void {
    const tools = program
        .command("tools")
        .description("Manage optional Captain companion CLI tools");

    tools
        .command("list")
        .description("List known Captain companion tools")
        .action(() => {
            printToolList();
        });

    tools
        .command("doctor")
        .description("Check optional Captain companion tool availability")
        .action(() => {
            const status = printToolDoctor();

            if (status !== 0) {
                process.exitCode = status;
            }
        });


    const registry = tools
        .command("registry")
        .description("Manage the project-local Captain tool registry");

    registry
        .command("list")
        .description("List project-local registered tools")
        .action(() => {
            printProjectRegistry();
        });

    registry
        .command("add")
        .description("Add a Captain tool manifest to the project-local registry")
        .argument("<manifest>", "Path to captain/tool.json")
        .action((manifest: string) => {
            try {
                const tool = addToolManifest(manifest);
                console.log(`Registered Captain tool: ${tool.name}`);
                console.log("");
                console.log("Registry updated: .captain/tools.json");
            } catch (error) {
                console.error(error instanceof Error ? error.message : String(error));
                process.exitCode = 1;
            }
        });

    tools
        .command("install")
        .description("Print or run install commands for optional Captain tools")
        .argument("<tool>", "Tool name, or 'all'")
        .option("--print", "Print install commands without running them")
        .option("--user", "Install with python -m pip install --user")
        .option(
            "--venv [path]",
            "Create/use a local virtual environment. Defaults to .venv when no path is provided.",
        )
        .action((target: string, options: InstallOptions) => {
            let installTargets;

            try {
                installTargets = getInstallTargets(target);
            } catch (error) {
                console.error(error instanceof Error ? error.message : String(error));
                process.exitCode = 1;
                return;
            }

            const mode = resolveInstallMode(options);
            let exitCode = 0;

            for (const tool of installTargets) {
               const status = installTool(tool, {
                  ...mode,
                  printOnly: Boolean(options.print),
               });

               if (status !== 0) {
                  exitCode = status;
                  break;
               }
            }
 
            if (exitCode !== 0) {
                process.exitCode = exitCode;
            }
        });
}
