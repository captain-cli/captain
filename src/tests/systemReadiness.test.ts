import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
    assertSystemReady,
    checkSystemReadiness,
} from "../core/systemReadiness.js";

import type {
    OutfitSystemStatus,
} from "../core/outfit.js";

function createProject(
    system?: {
        requires: string[];
    },
): string {
    const rootDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "captain-system-readiness-"),
    );

    fs.writeFileSync(
        path.join(
            rootDir,
            "manifest.json"
        ),
        `${JSON.stringify(
            {
                schema: "captain/manifest/v1",
                project: {
                    name: "system-readiness-test",
                    type: "application",
                    version: "1.0.0",
                },
                ...(system ? { system } : {}),
            },
            null,
            2,
        )}\n`,
    );

    return rootDir;
}

function outfitStatus(
    satisfied: boolean,
    pendingChanges: number,
): OutfitSystemStatus {
    return {
        available: true,
        satisfied,
        pendingChanges,
        response: {
            tool: "outfit",
            version: "test",
            operation: "plan",
            status: satisfied ? "satisfied" : "planned",
            changed: !satisfied,
        },
    };
}

test("projects without system requirements are ready without invoking Outfit", async () => {
    const rootDir = createProject();

    let invoked = false;

    try {
        const result = await checkSystemReadiness(
            rootDir,
            "../captain-outfit-registry",
            () => {
                invoked = true;
                return outfitStatus(true, 0);
            },
        );

        assert.equal(result.declared, false);
        assert.equal(result.satisfied, true);
        assert.equal(result.pendingChanges, 0);
        assert.deepEqual(result.requirements, []);
        assert.equal(invoked, false);
    } finally {
        fs.rmSync(rootDir, {
            recursive: true,
            force: true,
        });
    }
});

test("satisfied system requirements allow the project to build", async () => {
    const rootDir = createProject({
        requires: ["ffmpeg"],
    });

    try {
        const result = await checkSystemReadiness(
            rootDir,
            "../captain-outfit-registry",
            (_rootDir, requirements) => {
                assert.deepEqual(
                    requirements,
                    ["ffmpeg"],
                );

                return outfitStatus(true, 0);
            },
        );

        assert.equal(result.declared, true);
        assert.equal(result.satisfied, true);
        assert.equal(result.pendingChanges, 0);
    } finally {
        fs.rmSync(rootDir, {
            recursive: true,
            force: true,
        });
    }
});

test("pending Outfit changes block system readiness", async () => {
    const rootDir = createProject({
        requires: ["ffmpeg", "sqlite3"],
    });

    try {
        const result = await checkSystemReadiness(
            rootDir,
            "../captain-outfit-registry",
            () => outfitStatus(false, 2),
        );

        assert.equal(result.declared, true);
        assert.equal(result.satisfied, false);
        assert.equal(result.pendingChanges, 2);
    } finally {
        fs.rmSync(rootDir, {
            recursive: true,
            force: true,
        });
    }
});

test("assertSystemReady rejects pending system changes", async () => {
    const rootDir = createProject({
        requires: ["ffmpeg"],
    });

    try {
        await assert.rejects(
            () =>
                assertSystemReady(
                    rootDir,
                    "../captain-outfit-registry",
                    () => outfitStatus(false, 1),
                ),
            /System dependencies are not satisfied: 1 change\(s\) pending.*captain system plan/,
        );
    } finally {
        fs.rmSync(rootDir, {
            recursive: true,
            force: true,
        });
    }
});