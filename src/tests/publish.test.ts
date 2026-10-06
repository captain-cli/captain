import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createPublishPlan, discoverPackageArtifacts, executePublish } from "../core/publish.js";

function fixture(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "captain-publish-"));
    fs.mkdirSync(path.join(root, ".captain/packages/deb"), { recursive: true });
    fs.mkdirSync(path.join(root, ".captain/packages/rpm/rpmbuild/RPMS/x86_64"), { recursive: true });
    fs.mkdirSync(path.join(root, ".captain/packages/rpm/rpmbuild/SPECS"), { recursive: true });
    fs.writeFileSync(path.join(root, ".captain/packages/deb/sample_1.0.0_amd64.deb"), "deb");
    fs.writeFileSync(path.join(root, ".captain/packages/rpm/rpmbuild/RPMS/x86_64/sample-1.0.0-1.x86_64.rpm"), "rpm");
    fs.writeFileSync(path.join(root, ".captain/packages/rpm/rpmbuild/SPECS/sample.spec"), "not an artifact");
    fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify({
        schema: "captain/manifest/v1",
        project: { name: "sample", type: "monolith", version: "1.0.0" },
        versionLanes: {},
        components: [],
        publish: {
            destinations: {
                github: {
                    provider: "github-release",
                    repository: "example/sample",
                },
                mirror: {
                    provider: "s3-compatible",
                    bucket: "sample-builds",
                },
            },
        },
    }));
    return root;
}

test("discovers only final deb and rpm package files", () => {
    const root = fixture();
    const artifacts = discoverPackageArtifacts(path.join(root, ".captain/packages"));
    assert.deepEqual(artifacts.map(item => item.name).sort(), [
        "sample-1.0.0-1.x86_64.rpm",
        "sample_1.0.0_amd64.deb",
    ]);
});

test("creates a GitHub release publish plan with version defaults", async () => {
    const root = fixture();
    const plan = await createPublishPlan(root, { destination: "github" });
    assert.equal(plan.destinations.length, 1);
    assert.equal(plan.destinations[0].provider, "github-release");
    assert.equal(plan.destinations[0].repository, "example/sample");
    assert.equal(plan.destinations[0].tag, "v1.0.0");
    assert.equal(plan.destinations[0].releaseName, "v1.0.0");
    assert.equal(plan.destinations[0].artifacts.length, 2);
});

test("can publish-plan one package format", async () => {
    const root = fixture();
    const plan = await createPublishPlan(root, { destination: "github", formats: ["deb"] });
    assert.deepEqual(plan.destinations[0].artifacts.map(item => item.format), ["deb"]);
});

test("rejects an unknown destination", async () => {
    const root = fixture();
    await assert.rejects(() => createPublishPlan(root, { destination: "missing" }), /not configured/);
});

test("dry run does not require credentials or invoke providers", async () => {
    const root = fixture();
    const result = await executePublish(root, { destination: "github", dryRun: true });
    assert.equal(result.published.length, 0);
    assert.equal(result.plan.destinations[0].tag, "v1.0.0");
});

test("unimplemented external providers stay behind the provider boundary", async () => {
    const root = fixture();
    await assert.rejects(
        () => executePublish(root, { destination: "mirror", token: "unused" }),
        /Publish provider is not implemented: s3-compatible/,
    );
});
