import {
    spawnSync
} from "node:child_process";

import fs from "node:fs";
import path from "node:path";

export interface OutfitApproveResponse {
    tool: string;
    version: string;
    operation: string;
    status: string;
    changed: boolean;

    result?: {
        approval?: {
            planId: string;

            fingerprint: {
                algorithm: string;
                value: string;
            };

            approvedAt: string;
            registryVersion: string;
            platform: string;
            packageManager: string;
        };

        artifact?: {
            type: string;
            path: string;
        };
    };
}

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

export interface OutfitApplyResponse {
    status:
        | "success"
        | "failed"
        | "satisfied";

    changed:
        boolean;

    executed:
        boolean;

    receiptPath:
        string | null;

    receipt:
        unknown | null;

    error?: {
        message: string;
    };
}

export interface OutfitSystemStatus {
    available: boolean;
    satisfied: boolean;
    pendingChanges: number;
    response: OutfitPlanResponse;
}

export function approveOutfitSystem(
    rootDir: string
): OutfitApproveResponse {
    const stateDir =
        getOutfitStateDir(
            rootDir
        );

    const planPath =
        path.join(
            stateDir,
            "plan.json"
        );

    const approvalPath =
        path.join(
            stateDir,
            "approval.json"
        );

    return invokeOutfit<
        OutfitApproveResponse
    >([
        "approve",

        "--plan",
        planPath,

        "--output",
        approvalPath,

        "--json"
    ]);
}

export function applyOutfitSystem(
    rootDir: string,
    registryPath: string
): OutfitApplyResponse {
    const stateDir =
        getOutfitStateDir(
            rootDir
        );

    const manifestPath =
        path.join(
            stateDir,
            "manifest.json"
        );

    const planPath =
        path.join(
            stateDir,
            "plan.json"
        );

    const approvalPath =
        path.join(
            stateDir,
            "approval.json"
        );

    return invokeOutfit<
        OutfitApplyResponse
    >(
        [
            "apply",

            "--manifest",
            manifestPath,

            "--registry",
            registryPath,

            "--plan",
            planPath,

            "--approval",
            approvalPath,

            "--json"
        ],
        {
            allowNonZero:
                true
        }
    );
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



function invokeOutfit<T>(
    args: string[],
    options: {
        allowNonZero?: boolean;
    } = {}
): T {
    const result =
        spawnSync(
            "outfit",
            args,
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

    if (result.error) {
        throw new Error(
            result.error.message
        );
    }

    let response: T;

    try {
        response =
            JSON.parse(
                result.stdout
            ) as T;
    } catch {
        throw new Error(
            result.stderr.trim() ||
            "Outfit returned invalid JSON"
        );
    }

    if (
        result.status !== 0 &&
        !options.allowNonZero
    ) {
        throw new Error(
            result.stderr.trim() ||
            "Outfit command failed"
        );
    }

    return response;
}

export function planOutfitSystem(
    rootDir: string,
    requirements: string[],
    registryPath: string
): OutfitPlanResponse {
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

    return invokeOutfit<
        OutfitPlanResponse
    >([
        "plan",

        "--manifest",
        manifestPath,

        "--registry",
        registryPath,

        "--output",
        planPath,

        "--json"
    ]);
}

export function getOutfitStatus(
    rootDir: string,
    requirements: string[],
    registryPath: string
): OutfitSystemStatus {
    const response =
        planOutfitSystem(
            rootDir,
            requirements,
            registryPath
        );

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
