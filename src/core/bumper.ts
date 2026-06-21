import { readJsonFile } from "./files.js";
import {
    readCaptainProject,
    writeCaptainProject,
} from "./manifest.js";
import { syncGeneratedManifests } from "./sync.js";
import { bumpVersion, isBumpLevel } from "./version.js";

import type { BumpPlan } from "./bumpAnalyzer.js";

export interface ApplyBumpResult {
    bumped: boolean;
    updates: Record<string, { from: string; to: string; level: string }>;
}

export async function readBumpPlan(planPath: string): Promise<BumpPlan> {
    return readJsonFile<BumpPlan>(planPath);
}

export async function applyBumpPlan(options: {
    rootDir: string;
    plan: BumpPlan;
}): Promise<ApplyBumpResult> {
    const project = await readCaptainProject(options.rootDir);
    const updates: ApplyBumpResult["updates"] = {};

    for (const [laneName, level] of Object.entries(options.plan.bumps)) {
        if (!isBumpLevel(level)) {
            throw new Error(`Invalid bump level for ${laneName}: ${level}`);
        }

        if (laneName === "master") {
            const from = project.project.version;
            const to = bumpVersion(from, level);

            project.project.version = to;

            updates[laneName] = {
                from,
                to,
                level,
            };

            continue;
        }

        const lane = project.versionLanes[laneName];

        if (!lane) {
            throw new Error(`Cannot bump missing version lane: ${laneName}`);
        }

        const from = lane.version;
        const to = bumpVersion(from, level);

        lane.version = to;

        updates[laneName] = {
            from,
            to,
            level,
        };
    }

    await writeCaptainProject(options.rootDir, project);
    await syncGeneratedManifests(options.rootDir);

    return {
        bumped: Object.keys(updates).length > 0,
        updates,
    };
}

export async function applySingleBump(options: {
    rootDir: string;
    laneName: string;
    level: string;
}): Promise<ApplyBumpResult> {
    if (!isBumpLevel(options.level)) {
        throw new Error(`Invalid bump level: ${options.level}`);
    }

    return applyBumpPlan({
        rootDir: options.rootDir,
        plan: {
            shouldBump: true,
            bumps: {
                [options.laneName]: options.level,
            },
            matches: {},
            changedFiles: [],
        },
    });
}