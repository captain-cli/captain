import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { executePackagePipeline } from "../core/packagePipeline.js";
import { createPublishPlan } from "../core/publish.js";

function writeJson(filePath: string, value: unknown): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function fixture(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "captain-e2e-"));

    fs.writeFileSync(path.join(root, "build-fixture.cjs"), [
        'const fs = require("node:fs");',
        'fs.mkdirSync("bin", { recursive: true });',
        'fs.writeFileSync("bin/sample", "captain-e2e\\n");',
    ].join("\n"));

    writeJson(path.join(root, "manifest.json"), {
        schema: "captain/manifest/v1",
        project: { name: "sample", type: "application", version: "1.2.3" },
        versionLanes: {},
        components: [],
        build: {
            schema: "captain/build/v0.1",
            application: { name: "sample", type: "native", language: "javascript" },
            vendor: [],
            environment: { build: [], runtime: [] },
            config: { runtime: [] },
            build: {
                workingDirectory: ".",
                commands: [`${JSON.stringify(process.execPath)} build-fixture.cjs`],
                outputs: ["bin/sample"],
            },
            package: {
                name: "sample",
                include: ["bin/sample"],
                output: { directory: ".captain/artifacts" },
            },
        },
        stager: {
            target: "linux",
            targets: {
                linux: {
                    directories: ["usr/bin"],
                    copies: [{ source: "bin/sample", destination: "usr/bin/sample" }],
                },
            },
        },
        embark: {
            formats: ["deb"],
            package: {
                schema: "embark/package/v1",
                package: {
                    name: "sample",
                    version: "1.2.3",
                    architecture: "x86_64",
                    description: "Captain end-to-end fixture",
                },
            },
        },
        publish: {
            destinations: {
                acceptance: { provider: "test-provider" },
            },
        },
    });

    const tools = path.join(root, ".test-tools");
    fs.mkdirSync(tools, { recursive: true });

    fs.writeFileSync(path.join(tools, "stager.cjs"), [
        'const fs = require("node:fs");',
        'const path = require("node:path");',
        'const args = process.argv.slice(2);',
        'const value = name => args[args.indexOf(name) + 1];',
        'const source = value("--source-root");',
        'const root = value("--root");',
        'if (!source || !root) process.exit(2);',
        'fs.mkdirSync(root, { recursive: true });',
        'fs.cpSync(source, root, { recursive: true });',
        'fs.writeFileSync(path.join(root, ".stager-complete"), "ok");',
    ].join("\n"));

    fs.writeFileSync(path.join(tools, "embark.cjs"), [
        'const fs = require("node:fs");',
        'const path = require("node:path");',
        'const args = process.argv.slice(2);',
        'const format = args[0];',
        'const value = name => args[args.indexOf(name) + 1];',
        'const staged = value("--staged");',
        'const output = value("--output");',
        'if (!format || !staged || !output || !fs.existsSync(path.join(staged, ".stager-complete"))) process.exit(3);',
        'fs.mkdirSync(output, { recursive: true });',
        'fs.writeFileSync(path.join(output, `sample-1.2.3.${format}`), "native-package-fixture");',
    ].join("\n"));

    return root;
}

test("modern Captain flow reaches publish planning through Outfit-ready build, Stager, and Embark boundaries", async () => {
    const root = fixture();
    const oldStager = process.env.CAPTAIN_STAGER_COMMAND;
    const oldEmbark = process.env.CAPTAIN_EMBARK_COMMAND;

    process.env.CAPTAIN_STAGER_COMMAND = JSON.stringify([
        process.execPath,
        path.join(root, ".test-tools", "stager.cjs"),
    ]);
    process.env.CAPTAIN_EMBARK_COMMAND = JSON.stringify([
        process.execPath,
        path.join(root, ".test-tools", "embark.cjs"),
    ]);

    try {
        const packagePlan = await executePackagePipeline(root);
        assert.equal(packagePlan.stagerTarget, "linux");
        assert.deepEqual(packagePlan.formats, ["deb"]);
        assert.equal(fs.existsSync(path.join(packagePlan.stagedRoot, ".stager-complete")), true);
        assert.equal(fs.existsSync(path.join(packagePlan.packageOutputRoot, "deb", "sample-1.2.3.deb")), true);

        const publishPlan = await createPublishPlan(root);
        assert.equal(publishPlan.projectName, "sample");
        assert.equal(publishPlan.projectVersion, "1.2.3");
        assert.equal(publishPlan.destinations.length, 1);
        assert.equal(publishPlan.destinations[0].provider, "test-provider");
        assert.deepEqual(
            publishPlan.destinations[0].artifacts.map(artifact => artifact.name),
            ["sample-1.2.3.deb"],
        );
    } finally {
        if (oldStager === undefined) delete process.env.CAPTAIN_STAGER_COMMAND;
        else process.env.CAPTAIN_STAGER_COMMAND = oldStager;
        if (oldEmbark === undefined) delete process.env.CAPTAIN_EMBARK_COMMAND;
        else process.env.CAPTAIN_EMBARK_COMMAND = oldEmbark;
    }
});
