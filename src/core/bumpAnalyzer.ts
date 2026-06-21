import { promises as fs } from "node:fs";

import { getChangedFilesFromGit } from "./git.js";
import { readBumpRules } from "./manifest.js";

import type { BumpRules } from "../types/manifest.js";

export interface BumpPlan {
    shouldBump: boolean;
    bumps: Record<string, "patch" | "minor" | "major">;
    matches: Record<string, string[]>;
    changedFiles: string[];
}

const IGNORED_ROOT_MATCH_PREFIXES = [
    ".git/",
    ".captain/",
    "manifest/",
    "node_modules/",
    "dist/",
    "build/",
    "coverage/",
    "tmp/",
    "temp/",
];

function normalizePath(value: string): string {
    return value.replace(/\\/g, "/").replace(/^\.?\//, "");
}

function isIgnoredRootMatch(filePath: string): boolean {
    return IGNORED_ROOT_MATCH_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

function matchesRulePath(filePath: string, rulePath: string): boolean {
    const normalizedFilePath = normalizePath(filePath);
    const normalizedRulePath = normalizePath(rulePath);

    if (normalizedRulePath === "." || normalizedRulePath === "./" || normalizedRulePath === "") {
        return !isIgnoredRootMatch(normalizedFilePath);
    }

    if (normalizedRulePath.endsWith("/")) {
        return normalizedFilePath.startsWith(normalizedRulePath);
    }

    return normalizedFilePath === normalizedRulePath;
}

export function analyzeChangedFiles(
    changedFiles: string[],
    bumpRules: BumpRules,
): BumpPlan {
    const bumps: BumpPlan["bumps"] = {};
    const matches: BumpPlan["matches"] = {};

    for (const changedFile of changedFiles) {
        for (const [laneName, laneRule] of Object.entries(bumpRules.lanes)) {
            for (const rulePath of laneRule.paths) {
                if (matchesRulePath(changedFile, rulePath)) {
                    bumps[laneName] = bumpRules.defaultBump;
                    matches[laneName] ??= [];

                    if (!matches[laneName].includes(changedFile)) {
                        matches[laneName].push(changedFile);
                    }
                }
            }
        }
    }

    return {
        shouldBump: Object.keys(bumps).length > 0,
        bumps,
        matches,
        changedFiles,
    };
}

export async function readChangedFilesFile(filePath: string): Promise<string[]> {
    const content = await fs.readFile(filePath, "utf-8");

    return content
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
}

export async function analyzeBumps(options: {
    rootDir: string;
    base?: string;
    changedFilesPath?: string;
}): Promise<BumpPlan> {
    const bumpRules = await readBumpRules(options.rootDir);

    const changedFiles = options.changedFilesPath
        ? await readChangedFilesFile(options.changedFilesPath)
        : await getChangedFilesFromGit(options.base ?? "origin/main");

    return analyzeChangedFiles(changedFiles, bumpRules);
}