import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type ProvisionPrepareOptions = {
    servicewrightConfig?: string;
    writeConfig?: string;
    writeEnv?: string;
    outputDir?: string;
    root?: string;
    reservedPortsFile?: string;
    startPort?: string;
    endPort?: string;
    protocol?: "tcp" | "udp";
    dryRun?: boolean;
    skipValidate?: boolean;
    json?: boolean;
    printOnly?: boolean;
};

type CommandSpec = {
    label: string;
    command: string;
    args: string[];
};

function resolvePath(rootDir: string, value: string): string {
    if (path.isAbsolute(value)) {
        return value;
    }

    return path.join(rootDir, value);
}

function commandExists(command: string): boolean {
    const result = spawnSync(command, ["--version"], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
    });

    return !result.error && result.status === 0;
}

function shellQuote(value: string): string {
    if (/^[A-Za-z0-9_./:=@+-]+$/.test(value)) {
        return value;
    }

    return `'${value.replace(/'/g, `'\\''`)}'`;
}

function formatCommand(spec: CommandSpec): string {
    return [spec.command, ...spec.args].map(shellQuote).join(" ");
}

function runCommand(spec: CommandSpec): number {
    console.log(`\n${spec.label}`);
    console.log(`$ ${formatCommand(spec)}`);

    const result = spawnSync(spec.command, spec.args, {
        stdio: "inherit",
    });

    if (result.error) {
        console.error(result.error.message);
        return 1;
    }

    return result.status ?? 1;
}

function listGeneratedUnits(outputDir: string): string[] {
    if (!fs.existsSync(outputDir)) {
        return [];
    }

    return fs
        .readdirSync(outputDir)
        .filter((fileName) => fileName.endsWith(".service"))
        .sort((left, right) => left.localeCompare(right))
        .map((fileName) => path.join(outputDir, fileName));
}

function printMissingToolHelp(toolName: "dockhand" | "servicewright"): void {
    console.error(`${toolName} is not installed or is not available on PATH.`);
    console.error("");
    console.error("Install or inspect the install command with:");
    console.error("");
    console.error(`  captain install ${toolName} --print`);
}

export async function prepareProvision(
    projectRoot: string,
    options: ProvisionPrepareOptions,
): Promise<number> {
    const rootDir = resolvePath(projectRoot, options.root || ".");
    const servicewrightConfig = resolvePath(rootDir, options.servicewrightConfig || "servicewright.json");
    const resolvedConfig = resolvePath(
        rootDir,
        options.writeConfig || ".captain/runtime/servicewright.resolved.json",
    );
    const envDir = resolvePath(rootDir, options.writeEnv || ".captain/runtime/environment");
    const outputDir = resolvePath(rootDir, options.outputDir || "systemd_units");
    const reservedPortsFile = options.reservedPortsFile
        ? resolvePath(rootDir, options.reservedPortsFile)
        : undefined;

    if (!fs.existsSync(servicewrightConfig)) {
        console.error(`Servicewright config not found: ${servicewrightConfig}`);
        console.error("");
        console.error("Create one in the project repo, then rerun:");
        console.error("");
        console.error("  captain provision prepare --servicewright-config servicewright.json");
        return 1;
    }

    if (!options.printOnly && !commandExists("dockhand")) {
        printMissingToolHelp("dockhand");
        return 1;
    }

    if (!options.printOnly && !options.dryRun && !commandExists("servicewright")) {
        printMissingToolHelp("servicewright");
        return 1;
    }

    const dockhandArgs = [
        "servicewright",
        "reconcile",
        "--config",
        servicewrightConfig,
        "--root",
        rootDir,
        "--write-config",
        resolvedConfig,
        "--write-env",
        envDir,
    ];

    if (reservedPortsFile) {
        dockhandArgs.push("--reserved-ports-file", reservedPortsFile);
    }

    if (options.startPort) {
        dockhandArgs.push("--start-port", options.startPort);
    }

    if (options.endPort) {
        dockhandArgs.push("--end-port", options.endPort);
    }

    if (options.protocol) {
        dockhandArgs.push("--protocol", options.protocol);
    }

    if (options.dryRun) {
        dockhandArgs.push("--dry-run");
    }

    if (options.json || options.dryRun) {
        dockhandArgs.push("--json");
    }

    const commands: CommandSpec[] = [
        {
            label: "Reconciling Servicewright runtime ports with Dockhand...",
            command: "dockhand",
            args: dockhandArgs,
        },
    ];

    if (!options.dryRun) {
        commands.push({
            label: "Generating systemd units with Servicewright...",
            command: "servicewright",
            args: [
                "generate",
                "--config",
                resolvedConfig,
                "--root",
                rootDir,
                "--output-dir",
                outputDir,
            ],
        });
    }

    if (options.printOnly) {
        console.log("Captain provision prepare command plan:");
        console.log("");
        for (const spec of commands) {
            console.log(`# ${spec.label}`);
            console.log(formatCommand(spec));
            console.log("");
        }

        if (!options.dryRun && !options.skipValidate) {
            console.log("# Validation runs after generation for each *.service file in:");
            console.log(outputDir);
            console.log("");
        }

        return 0;
    }

    for (const spec of commands) {
        const status = runCommand(spec);
        if (status !== 0) {
            return status;
        }
    }

    if (options.dryRun) {
        console.log("");
        console.log("Dry run complete. Servicewright generation was skipped.");
        return 0;
    }

    if (options.skipValidate) {
        return 0;
    }

    const units = listGeneratedUnits(outputDir);

    if (units.length === 0) {
        console.error(`No generated .service files found in: ${outputDir}`);
        return 1;
    }

    for (const unitPath of units) {
        const status = runCommand({
            label: `Validating generated unit: ${unitPath}`,
            command: "servicewright",
            args: ["validate", unitPath],
        });

        if (status !== 0) {
            return status;
        }
    }

    console.log("");
    console.log("Captain provision prepare complete.");
    console.log(`Resolved config: ${resolvedConfig}`);
    console.log(`Environment dir: ${envDir}`);
    console.log(`Systemd units: ${outputDir}`);

    return 0;
}
