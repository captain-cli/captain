import { spawnSync } from "node:child_process";
import path from "node:path";

export type ToolInstallManager = "pip";

export type ToolDefinition = {
    name: string;
    description: string;
    binary: string;
    manager: ToolInstallManager;
    packageSpec: string;
};

export type ToolInstallMode = "print" | "user" | "venv";

export const CAPTAIN_TOOLS: ToolDefinition[] = [
    {
        name: "dockhand",
        description: "Runtime port/env preparation and reservation management",
        binary: "dockhand",
        manager: "pip",
        packageSpec: "git+ssh://git@github.com/captain-cli/dockhand.git",
    },
];

export function getTool(name: string): ToolDefinition | undefined {
    return CAPTAIN_TOOLS.find((tool) => tool.name === name);
}

export function getInstallTargets(target: string): ToolDefinition[] {
    if (target === "all") {
        return CAPTAIN_TOOLS;
    }

    const tool = getTool(target);

    if (!tool) {
        throw new Error(`Unknown Captain tool: ${target}`);
    }

    return [tool];
}

export function toolExists(tool: ToolDefinition): boolean {
    const result = spawnSync(tool.binary, ["--version"], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
    });

    return !result.error && result.status === 0;
}

export function getToolVersion(tool: ToolDefinition): string | null {
    const result = spawnSync(tool.binary, ["--version"], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
    });

    if (result.error || result.status !== 0) {
        return null;
    }

    return result.stdout.trim() || result.stderr.trim() || null;
}

export function buildInstallCommand(
    tool: ToolDefinition,
    options: {
        mode: ToolInstallMode;
        venvPath?: string;
    },
): string[] {
    if (tool.manager !== "pip") {
        throw new Error(`Unsupported install manager: ${tool.manager}`);
    }

    if (options.mode === "venv") {
        const venvPath = options.venvPath || ".venv";
        const pythonPath = path.join(venvPath, "bin", "python");
        return [
            "python3",
            "-m",
            "venv",
            venvPath,
            "&&",
            pythonPath,
            "-m",
            "pip",
            "install",
            "--upgrade",
            "pip",
            "setuptools",
            "wheel",
            "&&",
            pythonPath,
            "-m",
            "pip",
            "install",
            tool.packageSpec,
        ];
    }

    if (options.mode === "user") {
        return [
            "python",
            "-m",
            "pip",
            "install",
            "--user",
            tool.packageSpec,
        ];
    }

    return [
        "python",
        "-m",
        "pip",
        "install",
        tool.packageSpec,
    ];
}

export function printInstallCommand(
    tool: ToolDefinition,
    options: {
        mode: ToolInstallMode;
        venvPath?: string;
    },
): void {
    const command = buildInstallCommand(tool, options);

    console.log(`${tool.name}:`);
    console.log(`  ${command.join(" ")}`);

    if (options.mode === "venv") {
        const venvPath = options.venvPath || ".venv";
        console.log("");
        console.log("  After installing, add it to PATH for this shell:");
        console.log("");
        console.log(`    export PATH="$PWD/${venvPath}/bin:$PATH"`);
    }
}

function runShellCommand(command: string[]): number {
    const result = spawnSync(command.join(" "), {
        shell: true,
        stdio: "inherit",
    });

    if (result.error) {
        console.error(result.error.message);
        return 1;
    }

    return result.status ?? 1;
}

export function installTool(
    tool: ToolDefinition,
    options: {
        mode: ToolInstallMode;
        venvPath?: string;
        printOnly?: boolean;
    },
): number {
    const command = buildInstallCommand(tool, options);

    if (options.printOnly || options.mode === "print") {
        printInstallCommand(tool, options);
        return 0;
    }

    console.log(`Installing ${tool.name}...`);
    return runShellCommand(command);
}

export function printToolList(): void {
    console.log("Available Captain CLI tools:");
    console.log("");

    for (const tool of CAPTAIN_TOOLS) {
        const installed = toolExists(tool);
        const version = getToolVersion(tool);

        console.log(`- ${tool.name}`);
        console.log(`  Description: ${tool.description}`);
        console.log(`  Binary:      ${tool.binary}`);
        console.log(`  Installed:   ${installed ? "yes" : "no"}`);

        if (version) {
            console.log(`  Version:     ${version}`);
        }

        console.log("");
    }
}

export function printToolDoctor(): number {
    console.log("Captain tools doctor:");
    console.log("");

    let missingCount = 0;

    for (const tool of CAPTAIN_TOOLS) {
        const installed = toolExists(tool);
        const version = getToolVersion(tool);

        if (!installed) {
            missingCount += 1;
        }

        console.log(`${installed ? "OK" : "MISSING"} ${tool.name}${version ? ` (${version})` : ""}`);
    }

    console.log("");

    if (missingCount > 0) {
        console.log("Missing optional tools can be installed with:");
        console.log("");
        console.log("  captain tools install all --print");
    }

    return missingCount > 0 ? 1 : 0;
}
