import {
    spawnSync
} from "node:child_process";

import fs from "node:fs";
import path from "node:path";

export interface OutfitPlanResponse {
    tool: string;
    version: string;
    operation: string;
    status: string;
    changed: boolean;

    result?: {
        plan?: {
            id: string;
            platform: string;
            packageManager: string;
            registryVersion: string;

            requirements: Array<{
                resolution: {
                    requirement: string;
                    canonicalId: string;
                    package: string;
                    source: string;
                };
            }>;

            transaction: {
                requestedPackages: string[];
                changes: unknown[];
                successful: boolean;
            };
        };
    };
}

export interface OutfitSystemStatus {
    available: boolean;
    satisfied: boolean;
    pendingChanges: number;
    response: OutfitPlanResponse;
}

export function getOutfitStateDir(
    rootDir: string
): string {
    return path.join(
        rootDir,
        ".captain",
        "outfit"
    );
}

export function writeOutfitManifest(
    rootDir: string,
    requirements: string[]
): string {
    const stateDir =
        getOutfitStateDir(rootDir);

    fs.mkdirSync(
        stateDir,
        {
            recursive: true
        }
    );

    const manifestPath =
        path.join(
            stateDir,
            "manifest.json"
        );

    fs.writeFileSync(
        manifestPath,
        `${JSON.stringify(
            {
                requires:
                requirements
            },
            null,
            2
        )}\n`
    );

    return manifestPath;
}

export function getOutfitStatus(
    rootDir: string,
    requirements: string[],
    registryPath: string
): OutfitSystemStatus {
    const manifestPath =
        writeOutfitManifest(
            rootDir,
            requirements
        );

    const planPath =
        path.join(
            getOutfitStateDir(
                rootDir
            ),
            "plan.json"
        );

    const result =
        spawnSync(
            "outfit",
            [
                "plan",

                "--manifest",
                manifestPath,

                "--registry",
                registryPath,

                "--output",
                planPath,

                "--json"
            ],
            {
                encoding:
                    "utf-8",

                stdio: [
                    "ignore",
                    "pipe",
                    "pipe"
                ]
            }
        );

    if (
        result.error ||
        result.status !== 0
    ) {
        throw new Error(
            result.stderr.trim() ||
            result.error?.message ||
            "Outfit plan failed"
        );
    }

    let response:
        OutfitPlanResponse;

    try {
        response =
            JSON.parse(
                result.stdout
            ) as OutfitPlanResponse;
    } catch {
        throw new Error(
            "Outfit returned invalid JSON"
        );
    }

    const changes =
        response.result
            ?.plan
            ?.transaction
            ?.changes ??
        [];

    return {
        available: true,
        satisfied:
            changes.length === 0,
        pendingChanges:
        changes.length,
        response
    };
}