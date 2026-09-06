import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createPackagePipelinePlan } from "../core/packagePipeline.js";

function fixture(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "captain-package-"));
    fs.mkdirSync(path.join(root, "manifest"), { recursive: true });
    fs.writeFileSync(path.join(root, "manifest", "captain.project.json"), JSON.stringify({
        schema: "captain/manifest/v1",
        project: { name: "sample", type: "monolith", version: "1.0.0" },
        versionLanes: {},
        components: [],
        packaging: {
            stager: { manifest: "manifest/stager.linux.json", target: "linux" },
            embark: { manifest: "manifest/embark.package.json", formats: ["deb", "rpm"] }
        }
    }));
    fs.writeFileSync(path.join(root, "manifest", "captain.build.json"), JSON.stringify({
        schema: "captain/build/v0.1",
        application: { name: "sample", type: "native", language: "cpp" },
        vendor: [],
        environment: { build: [], runtime: [] },
        config: { runtime: [] },
        build: { workingDirectory: ".", commands: [], outputs: ["bin/sample"] },
        package: { name: "sample", include: ["bin/sample"], output: { directory: ".captain/artifacts" } }
    }));
    fs.writeFileSync(path.join(root, "manifest", "stager.linux.json"), "{}");
    fs.writeFileSync(path.join(root, "manifest", "embark.package.json"), "{}");
    return root;
}

test("creates a deterministic package handoff plan", () => {
    const root = fixture();
    const plan = createPackagePipelinePlan(root);
    assert.equal(plan.stagedRoot, path.join(root, ".captain/staged/linux/sample"));
    assert.equal(plan.packageOutputRoot, path.join(root, ".captain/packages"));
    assert.deepEqual(plan.formats, ["deb", "rpm"]);
});

test("can select one enabled package format", () => {
    const root = fixture();
    const plan = createPackagePipelinePlan(root, ["rpm"]);
    assert.deepEqual(plan.formats, ["rpm"]);
});

test("rejects project manifest paths that escape the project", () => {
    const root = fixture();
    const projectPath = path.join(root, "manifest", "captain.project.json");
    const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));
    project.packaging.stager.manifest = "../../outside.json";
    fs.writeFileSync(projectPath, JSON.stringify(project));
    assert.throws(() => createPackagePipelinePlan(root), /escapes the project root/);
});
