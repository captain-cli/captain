import { Command } from "commander";

import { prepareDeploy } from "../core/deploy.js";

export function registerDeployCommand(program: Command): void {
    const deploy = program
        .command("deploy")
        .description("Prepare deployable runtime artifacts with Captain companion tools");

    deploy
        .command("prepare")
        .description("Run Dockhand Servicewright reconciliation, generate systemd units, then validate them")
        .option(
            "--servicewright-config <path>",
            "Servicewright config path committed in the project repo",
            "servicewright.json",
        )
        .option(
            "--write-config <path>",
            "Resolved Servicewright config output path",
            ".captain/runtime/servicewright.resolved.json",
        )
        .option(
            "--write-env <path>",
            "Directory for Dockhand-generated per-service env files",
            ".captain/runtime/environment",
        )
        .option(
            "--output-dir <path>",
            "Directory for generated systemd unit files",
            "systemd_units",
        )
        .option("--root <path>", "Project root used to resolve relative paths", ".")
        .option("--reserved-ports-file <path>", "Dockhand reserved ports file path")
        .option("--start-port <port>", "Default Dockhand start port")
        .option("--end-port <port>", "Default Dockhand end port")
        .option("--protocol <protocol>", "Protocol for port reservations: tcp or udp", "tcp")
        .option("--dry-run", "Preview Dockhand reconciliation without writing runtime files or generating units")
        .option("--skip-validate", "Skip Servicewright validation after unit generation")
        .option("--json", "Ask Dockhand to print JSON output")
        .option("--print", "Print the underlying commands without running them")
        .action(async (options) => {
            const status = await prepareDeploy(process.cwd(), {
                servicewrightConfig: options.servicewrightConfig,
                writeConfig: options.writeConfig,
                writeEnv: options.writeEnv,
                outputDir: options.outputDir,
                root: options.root,
                reservedPortsFile: options.reservedPortsFile,
                startPort: options.startPort,
                endPort: options.endPort,
                protocol: options.protocol,
                dryRun: Boolean(options.dryRun),
                skipValidate: Boolean(options.skipValidate),
                json: Boolean(options.json),
                printOnly: Boolean(options.print),
            });

            if (status !== 0) {
                process.exitCode = status;
            }
        });
}
