import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type ToolInstallManager =
    | "pip"
    | "npm"
    | "external";

export type ToolDefinition = {
    name: string;
    description: string;
    binary: string;
    manager: ToolInstallManager;
    packageSpec?: string;
    version?: string;
    category?: string;
    source?: "builtin" | "project";
    capabilities?: string[];
    sourceRoot?: string;
};

export type ToolInstallMode = "print" | "user" | "venv";

export type ToolRegistryFile = {
    version: number;
    tools: ToolDefinition[];
};

const DEFAULT_REGISTRY_PATH = ".captain/tools.json";

export const CAPTAIN_TOOLS: ToolDefinition[] = [
    {
        name: "dockhand",
        description: "Runtime port/env preparation and reservation management",
        binary: "dockhand",
        manager: "pip",
        packageSpec: "git+ssh://git@github.com/captain-cli/dockhand.git",
        category: "runtime",
        source: "builtin",
        capabilities: [
            "ports.reserve",
            "environment.generate",
            "runtime.prepare",
        ],
    },
    {
        name: "outfit",
        description:
            "Trusted operating-system dependency provisioning",
        binary: "outfit",
        manager: "external",
        category: "system",
        source: "builtin",
        capabilities: [
            "system.dependencies.resolve",
            "system.dependencies.plan",
            "system.dependencies.approve",
            "system.dependencies.apply",
            "system.dependencies.verify"
        ],
    },
    {
        name: "servicewright",
        description: "Project-agnostic systemd service unit generator",
        binary: "servicewright",
        manager: "pip",
        packageSpec: "git+ssh://git@github.com/captain-cli/servicewright.git",
        category: "devops",
        source: "builtin",
        capabilities: [
            "systemd.unit.generate",
            "systemd.user-service.generate",
            "systemd.hardening.apply",
            "environment-file.reference",
        ],
    },
    {
        name: "stager",
        description:
            "Project staging and controlled file preparation for Captain workflows",
        binary: "stager",
        manager: "npm",
        packageSpec:
            "git+ssh://git@github.com/captain-cli/stager.git",
        category: "development",
        source: "builtin",
        capabilities: [
            "project.stage",
            "files.prepare",
            "workspace.prepare"
        ],
    },

];

function resolveRegistryPath(registryPath = DEFAULT_REGISTRY_PATH): string {
    return path.resolve(process.cwd(), registryPath);
}

function ensureToolInstallManager(value: unknown): ToolInstallManager {
    if (value === "pip" || !value) {
        return "pip";
    }

    if (
        value === "pip" ||
        value === "npm" ||
        value === "external"
    ) {
        return value;
    }

    throw new Error(`Unsupported tool install manager: ${String(value)}`);
}

function packageSpecFromInstallCommand(installCommand: unknown): string {
    if (typeof installCommand !== "string" || installCommand.trim() === "") {
        return "";
    }

    const trimmed = installCommand.trim();
    const pipInstallPrefixes = [
        "python -m pip install ",
        "python3 -m pip install ",
        "pip install ",
        "pip3 install ",
    ];

    for (const prefix of pipInstallPrefixes) {
        if (trimmed.startsWith(prefix)) {
            return trimmed.slice(prefix.length).trim();
        }
    }

    return trimmed;
}

function normalizeToolDefinition(raw: Record<string, unknown>, manifestPath?: string): ToolDefinition {
    const name = String(raw.name || "").trim();

    if (!name) {
        throw new Error("Tool manifest is missing required field: name");
    }

    const runtime = (raw.runtime || {}) as Record<string, unknown>;
    const packageInfo = (raw.package || {}) as Record<string, unknown>;
    const commands = Array.isArray(raw.commands) ? raw.commands as Record<string, unknown>[] : [];
    const firstCommand = commands[0] || {};

    const binary = String(raw.binary || runtime.entrypoint || firstCommand.exec || name).trim();
    const manager = ensureToolInstallManager(raw.manager || packageInfo.manager);
    let packageSpec = String(
        raw.packageSpec ||
        packageInfo.packageSpec ||
        packageSpecFromInstallCommand(packageInfo.install) ||
        "",
    ).trim();

    const manifestDirectory = manifestPath ? path.dirname(manifestPath) : process.cwd();
    const sourceRoot = path.basename(manifestDirectory) === "captain"
        ? path.dirname(manifestDirectory)
        : manifestDirectory;

    if (packageSpec === "-e ." || packageSpec === ".") {
        packageSpec = `-e ${sourceRoot}`;
    }

    if (!binary) {
        throw new Error(`Tool manifest for ${name} is missing a binary/entrypoint`);
    }

    if (!packageSpec) {
        throw new Error(`Tool manifest for ${name} is missing package.packageSpec or package.install`);
    }

    return {
        name,
        description: String(raw.description || `${name} Captain companion tool`),
        binary,
        manager,
        packageSpec,
        version: typeof raw.version === "string" ? raw.version : undefined,
        category: typeof raw.category === "string" ? raw.category : undefined,
        source: "project",
        capabilities: Array.isArray(raw.capabilities)
            ? raw.capabilities.map((capability) => String(capability))
            : undefined,
        sourceRoot,
    };
}

export function readProjectToolRegistry(registryPath = DEFAULT_REGISTRY_PATH): ToolRegistryFile {
    const absolutePath = resolveRegistryPath(registryPath);

    if (!fs.existsSync(absolutePath)) {
        return { version: 1, tools: [] };
    }

    const parsed = JSON.parse(fs.readFileSync(absolutePath, "utf-8")) as Partial<ToolRegistryFile> | ToolDefinition[];

    if (Array.isArray(parsed)) {
        return {
            version: 1,
            tools: parsed.map((tool) => ({ ...tool, source: "project" })),
        };
    }

    return {
        version: parsed.version || 1,
        tools: (parsed.tools || []).map((tool) => ({ ...tool, source: "project" })),
    };
}

export function writeProjectToolRegistry(registry: ToolRegistryFile, registryPath = DEFAULT_REGISTRY_PATH): void {
    const absolutePath = resolveRegistryPath(registryPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, `${JSON.stringify(registry, null, 2)}\n`);
}

export function addToolManifest(manifestPath: string, registryPath = DEFAULT_REGISTRY_PATH): ToolDefinition {
    const absoluteManifestPath = path.resolve(process.cwd(), manifestPath);

    if (!fs.existsSync(absoluteManifestPath)) {
        throw new Error(`Tool manifest not found: ${manifestPath}`);
    }

    const raw = JSON.parse(fs.readFileSync(absoluteManifestPath, "utf-8")) as Record<string, unknown>;
    const tool = normalizeToolDefinition(raw, absoluteManifestPath);
    const registry = readProjectToolRegistry(registryPath);
    const tools = registry.tools.filter((existing) => existing.name !== tool.name);

    tools.push(tool);
    tools.sort((left, right) => left.name.localeCompare(right.name));

    writeProjectToolRegistry({ version: 1, tools }, registryPath);
    return tool;
}

export function getAllTools(): ToolDefinition[] {
    const merged = new Map<string, ToolDefinition>();

    for (const tool of CAPTAIN_TOOLS) {
        merged.set(tool.name, { ...tool, source: "builtin" });
    }

    for (const tool of readProjectToolRegistry().tools) {
        merged.set(tool.name, { ...tool, source: "project" });
    }

    return Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export function getTool(name: string): ToolDefinition | undefined {
    return getAllTools().find((tool) => tool.name === name);
}

export function getInstallTargets(
    target: string
): ToolDefinition[] {
    if (target === "all") {
        return getAllTools()
            .filter(
                (tool) =>
                    tool.manager !== "external"
            );
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
    if (tool.manager === "external") {
        throw new Error(
            `${tool.name} requires external/system installation`
        );
    }

    if (!tool.packageSpec) {
        throw new Error(
            `${tool.name} is missing an install package specification`
        );
    }

    const packageSpec =
        tool.packageSpec;

    if (tool.manager === "npm") {
        return [
            "npm",
            "install",
            "--global",
            packageSpec
        ];
    }

    if (tool.manager !== "pip") {
        throw new Error(
            `Unsupported install manager: ${tool.manager}`
        );
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

    if (tool.manager === "external") {
        console.error(
            `${tool.name} requires external/system installation and cannot be installed by Captain`
        );

        return 1;
    }

    const command =
        buildInstallCommand(
            tool,
            options
        );

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

    for (const tool of getAllTools()) {
        const installed = toolExists(tool);
        const version = getToolVersion(tool);

        console.log(`- ${tool.name}`);
        console.log(`  Description: ${tool.description}`);
        console.log(`  Binary:      ${tool.binary}`);
        console.log(`  Source:      ${tool.source || "builtin"}`);
        console.log(`  Installed:   ${installed ? "yes" : "no"}`);

        if (tool.category) {
            console.log(`  Category:    ${tool.category}`);
        }

        if (version || tool.version) {
            console.log(`  Version:     ${version || tool.version}`);
        }

        if (tool.capabilities?.length) {
            console.log(`  Capabilities: ${tool.capabilities.join(", ")}`);
        }

        console.log("");
    }
}

export function printProjectRegistry(registryPath = DEFAULT_REGISTRY_PATH): void {
    const registry = readProjectToolRegistry(registryPath);

    console.log(`Project tool registry: ${registryPath}`);
    console.log("");

    if (registry.tools.length === 0) {
        console.log("No project tools registered yet.");
        console.log("");
        console.log("Add one with:");
        console.log("");
        console.log("  captain tools registry add ./captain/tool.json");
        return;
    }

    for (const tool of registry.tools) {
        console.log(`- ${tool.name}`);
        console.log(`  Description: ${tool.description}`);
        console.log(`  Binary:      ${tool.binary}`);
        console.log(`  Package:     ${tool.packageSpec}`);

        if (tool.sourceRoot) {
            console.log(`  Source root: ${tool.sourceRoot}`);
        }

        if (tool.capabilities?.length) {
            console.log(`  Capabilities: ${tool.capabilities.join(", ")}`);
        }

        console.log("");
    }
}

export function printToolDoctor(): number {
    console.log("Captain tools doctor:");
    console.log("");

    let missingCount = 0;

    for (const tool of getAllTools()) {
        const installed = toolExists(tool);
        const version = getToolVersion(tool);

        if (!installed) {
            missingCount += 1;
        }

        console.log(`${installed ? "OK" : "MISSING"} ${tool.name}${version ? ` (${version})` : ""}`);
    }

    console.log("");

    const missingManaged =
        getAllTools()
            .filter(
                (tool) =>
                    tool.manager !== "external" &&
                    !toolExists(tool)
            );

    const missingExternal =
        getAllTools()
            .filter(
                (tool) =>
                    tool.manager === "external" &&
                    !toolExists(tool)
            );

    if (missingManaged.length > 0) {
        console.log(
            "Missing Captain-managed tools can be installed with:"
        );

        console.log("");

        console.log(
            "  captain tools install all --print"
        );
    }

    if (missingExternal.length > 0) {
        console.log("");

        console.log(
            "External/system tools must be installed separately:"
        );

        for (
            const tool of
            missingExternal
            ) {
            console.log(
                `  - ${tool.name}`
            );
        }
    }

    return missingCount > 0 ? 1 : 0;
}
