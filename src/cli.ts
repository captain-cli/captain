#!/usr/bin/env node

import { Command } from "commander";

import { registerInitCommand } from "./commands/init.js";
import { registerLaneCommand } from "./commands/lane.js";
import { registerComponentCommand } from "./commands/component.js";
import { registerGenerateCommand } from "./commands/generate.js";
import { registerScanCommand } from "./commands/scan.js";
import { registerAnalyzeBumpsCommand } from "./commands/analyzeBumps.js";
import { registerBumpCommand } from "./commands/bump.js";
import { registerValidateCommand } from "./commands/validate.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerPrepareRuntimeCommand } from "./commands/prepareRuntime.js";
import { registerToolsCommand } from "./commands/tools.js";
import { registerDeployCommand } from "./commands/deploy.js";
import {
    registerSystemCommand
} from "./commands/system.js";
import {
    registerBuildCommand
} from "./commands/build.js";

const program = new Command();

program
    .name("captain")
    .description("Captain's Manifest CLI")
    .version("0.2.0", "-V, --cli-version", "output the Captain CLI version");

registerInitCommand(program);
registerLaneCommand(program);
registerComponentCommand(program);
registerGenerateCommand(program);
registerScanCommand(program);
registerAnalyzeBumpsCommand(program);
registerBumpCommand(program);
registerValidateCommand(program);
registerStatusCommand(program);
registerPrepareRuntimeCommand(program);
registerToolsCommand(program);
registerDeployCommand(program);
registerSystemCommand(
    program
);
registerBuildCommand(program);

program.parse(process.argv);
