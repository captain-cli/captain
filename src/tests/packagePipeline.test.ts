import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createPackagePipelinePlan } from "../core/packagePipeline.js";

function fixture(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "captain-package-"));
    fs.mkdirSync(path.join(root, "manifest"), { recursive: true });
    fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify({
        schema: "captain/manifest/v1",
        project: { name: "sample", type: "monolith", version: "1.0.0" },
        versionLanes: {},
        components: [],
        build: {
            schema: "captain/build/v0.1",
            application: { name: "sample", type: "native", language: "cpp" },
            vendor: [],
            environment: { build: [], runtime: [] },
            config: { runtime: [] },
            build: { workingDirectory: ".", commands: [], outputs: ["bin/sample"] },
            package: { name: "sample", include: ["bin/sample"], output: { directory: ".captain/artifacts" } }
        },
        stager: {
            target: "linux",
            targets: {
                linux: { directories: ["usr/bin"] }
            }
        },
        embark: {
            formats: ["deb", "rpm"],
            package: {
                name: "sample", version: "1.0.0", architecture: "x86_64", description: "sample"
            }
        }
    }));
    return root;
}

test("creates a deterministic package handoff plan", async () => {
    const root = fixture();
    const plan = await createPackagePipelinePlan(root);
    assert.equal(plan.stagedRoot, path.join(root, ".captain/staged/linux/sample"));
    assert.equal(plan.packageOutputRoot, path.join(root, ".captain/packages"));
    assert.deepEqual(plan.formats, ["deb", "rpm"]);
});

test("can select one enabled package format", async () => {
    const root = fixture();
    const plan = await createPackagePipelinePlan(root, ["rpm"]);
    assert.deepEqual(plan.formats, ["rpm"]);
});

test("requires Captain-owned Stager configuration", async () => {
    const root = fixture();
    const projectPath = path.join(root, "manifest.json");
    const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));
    delete project.stager;
    fs.writeFileSync(projectPath, JSON.stringify(project));
    await assert.rejects(() => createPackagePipelinePlan(root), /configuration "stager" is required/);
});

test("package handoff uses the Captain project instead of a raw Stager manifest", async () => {
    const root = fixture();
    const plan = await createPackagePipelinePlan(root);
    assert.equal(plan.projectRoot, root);
    assert.equal("stagerManifest" in plan, false);
});


test("requires Captain-owned Embark configuration", async () => {
    const root = fixture();
    const projectPath = path.join(root, "manifest.json");
    const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));
    delete project.embark;
    fs.writeFileSync(projectPath, JSON.stringify(project));
    await assert.rejects(() => createPackagePipelinePlan(root), /configuration "embark" is required/);
});

test("package handoff uses the Captain project instead of a raw Embark manifest", async () => {
    const root = fixture();
    const plan = await createPackagePipelinePlan(root);
    assert.equal(plan.projectRoot, root);
    assert.equal("embarkManifest" in plan, false);
});


test("requires stager.target from the first-class Stager configuration", async () => {
    const root = fixture();
    const projectPath = path.join(root, "manifest.json");
    const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));
    delete project.stager.target;
    fs.writeFileSync(projectPath, JSON.stringify(project));
    await assert.rejects(() => createPackagePipelinePlan(root), /stager\.target is required/);
});

test("requires embark.formats from the first-class Embark configuration", async () => {
    const root = fixture();
    const projectPath = path.join(root, "manifest.json");
    const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));
    delete project.embark.formats;
    fs.writeFileSync(projectPath, JSON.stringify(project));
    await assert.rejects(() => createPackagePipelinePlan(root), /embark\.formats must contain at least one/);
});
