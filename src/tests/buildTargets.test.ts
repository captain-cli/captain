import assert from "node:assert/strict";
import test from "node:test";

import { listBuildTargets, resolveBuildTarget } from "../core/buildTarget.js";
import type { CaptainBuildManifest } from "../types/build.js";

function multiTargetManifest(): CaptainBuildManifest {
    return {
        schema: "captain/build/v0.2",
        application: { name: "sample", type: "monorepo", language: "typescript" },
        vendor: [],
        environment: { build: [], runtime: [] },
        config: { runtime: [] },
        defaultTarget: "web",
        targets: {
            web: {
                build: { workingDirectory: ".", commands: ["npm run web"], outputs: ["dist/web/index.html"] },
                package: { name: "sample-web", include: ["dist/web/**"], output: { directory: ".captain/artifacts" } },
            },
            electron: {
                build: { workingDirectory: ".", commands: ["npm run electron"], outputs: ["dist/electron/app.AppImage"] },
                package: { name: "sample-electron", include: ["dist/electron/**"], output: { directory: ".captain/artifacts" } },
            },
        },
    };
}

test("lists named build targets", () => {
    assert.deepEqual(listBuildTargets(multiTargetManifest()), ["web", "electron"]);
});

test("selects the default build target", () => {
    const selected = resolveBuildTarget(multiTargetManifest());
    assert.equal(selected.name, "web");
    assert.equal(selected.package.name, "sample-web");
});

test("selects an explicit build target", () => {
    const selected = resolveBuildTarget(multiTargetManifest(), "electron");
    assert.equal(selected.name, "electron");
    assert.deepEqual(selected.build.commands, ["npm run electron"]);
});

test("rejects an unknown build target", () => {
    assert.throws(
        () => resolveBuildTarget(multiTargetManifest(), "mobile"),
        /Unknown build target 'mobile'.*web, electron/,
    );
});

test("preserves captain\/build\/v0.1 single-build behavior", () => {
    const manifest: CaptainBuildManifest = {
        schema: "captain/build/v0.1",
        application: { name: "legacy", type: "native", language: "cpp" },
        vendor: [],
        environment: { build: [], runtime: [] },
        config: { runtime: [] },
        build: { workingDirectory: ".", commands: ["cmake --build build"], outputs: ["bin/app"] },
        package: { name: "legacy", include: ["bin/app"], output: { directory: ".captain/artifacts" } },
    };
    const selected = resolveBuildTarget(manifest);
    assert.equal(selected.name, undefined);
    assert.deepEqual(selected.build.commands, ["cmake --build build"]);
});
