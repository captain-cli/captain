import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
    createCaptainProject,
    getBumpRulesPath,
    getCaptainProjectPath,
    getMasterManifestPath,
} from "../core/manifest.js";
import { resolveToolConfig } from "../core/toolManifest.js";

function fixture(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "captain-manifest-"));
}

test("uses project-root manifest.json as the Captain-owned source manifest", () => {
    const root = path.join(os.tmpdir(), "sample-captain-project");
    assert.equal(getCaptainProjectPath(root), path.join(root, "manifest.json"));
});

test("keeps generated release metadata outside the source manifest", () => {
    const root = path.join(os.tmpdir(), "sample-captain-project");
    assert.equal(getMasterManifestPath(root), path.join(root, ".captain", "generated", "master_manifest.json"));
    assert.equal(getBumpRulesPath(root), path.join(root, ".captain", "generated", "bump_rules.json"));
});

test("new manifests use the shared captain/manifest/v1 contract", () => {
    const manifest = createCaptainProject({
        name: "sample",
        type: "native",
        version: "1.0.0",
    });
    assert.equal(manifest.schema, "captain/manifest/v1");
});

test("resolves inline tool configuration", async () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify({
        schema: "captain/manifest/v1",
        project: { name: "sample", type: "native", version: "1.0.0" },
        versionLanes: {},
        components: [],
        stager: { target: "linux" },
    }));

    const resolved = await resolveToolConfig(root, "stager", { required: true });
    assert.equal(resolved!.inline, true);
    assert.deepEqual(resolved!.config, { target: "linux" });
});

test("resolves Captain-owned split tool configuration", async () => {
    const root = fixture();
    fs.mkdirSync(path.join(root, "manifests"));
    fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify({
        schema: "captain/manifest/v1",
        project: { name: "sample", type: "native", version: "1.0.0" },
        versionLanes: {},
        components: [],
        manifests: { stager: "manifests/stager.json" },
    }));
    fs.writeFileSync(path.join(root, "manifests", "stager.json"), JSON.stringify({
        schema: "captain/tool-manifest/v1",
        tool: "stager",
        config: { target: "linux" },
    }));

    const resolved = await resolveToolConfig(root, "stager", { required: true });
    assert.equal(resolved!.inline, false);
    assert.equal(resolved!.path, path.join(root, "manifests", "stager.json"));
    assert.deepEqual(resolved!.config, { target: "linux" });
});

test("supports hybrid inline and split tool configuration", async () => {
    const root = fixture();
    fs.mkdirSync(path.join(root, "manifests"));
    fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify({
        schema: "captain/manifest/v1",
        project: { name: "sample", type: "native", version: "1.0.0" },
        versionLanes: {},
        components: [],
        build: { schema: "captain/build/v0.1" },
        manifests: { embark: "manifests/embark.json" },
    }));
    fs.writeFileSync(path.join(root, "manifests", "embark.json"), JSON.stringify({
        schema: "captain/tool-manifest/v1",
        tool: "embark",
        config: { formats: ["deb"] },
    }));

    const build = await resolveToolConfig(root, "build", { required: true });
    const embark = await resolveToolConfig(root, "embark", { required: true });
    assert.equal(build!.inline, true);
    assert.equal(embark!.inline, false);
});

test("rejects duplicate inline and referenced configuration", async () => {
    const root = fixture();
    fs.mkdirSync(path.join(root, "manifests"));
    fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify({
        schema: "captain/manifest/v1",
        project: { name: "sample", type: "native", version: "1.0.0" },
        versionLanes: {},
        components: [],
        stager: { target: "linux" },
        manifests: { stager: "manifests/stager.json" },
    }));
    await assert.rejects(() => resolveToolConfig(root, "stager"), /both inline/);
});

import { requireCaptainManifest, resolveProjectDirectory } from "../core/projectContext.js";

test("uses an explicit project directory without searching parent directories", () => {
    const root = fixture();
    const nested = path.join(root, "nested");
    fs.mkdirSync(nested);
    fs.writeFileSync(path.join(root, "manifest.json"), "{}");

    assert.equal(resolveProjectDirectory(nested), nested);
    assert.throws(() => requireCaptainManifest(nested), /manifest not found/);
});

test("accepts a project directory when manifest.json exists there", () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, "manifest.json"), "{}");
    assert.equal(requireCaptainManifest(root), path.join(root, "manifest.json"));
});

import { readCaptainProject } from "../core/manifest.js";

test("rejects the removed packaging orchestration contract", async () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify({
        schema: "captain/manifest/v1",
        project: { name: "sample", type: "native", version: "1.0.0" },
        versionLanes: {},
        components: [],
        packaging: { stager: { target: "linux" }, embark: { formats: ["deb"] } },
    }));

    await assert.rejects(
        () => readCaptainProject(root),
        /Deprecated manifest property packaging is no longer supported/,
    );
});

test("rejects unsupported Captain manifest schemas at the engine boundary", async () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify({
        schema: "captain/manifest/v0",
        project: { name: "sample", type: "native", version: "1.0.0" },
        versionLanes: {},
        components: [],
    }));

    await assert.rejects(() => readCaptainProject(root), /Unsupported Captain manifest schema/);
});
