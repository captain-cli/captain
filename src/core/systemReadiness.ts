import path from "node:path";

import { readCaptainProject } from "./manifest.js";
import { getOutfitStatus, type OutfitSystemStatus } from "./outfit.js";

type OutfitStatusProvider = (
    rootDir: string,
    requirements: string[],
    registryPath: string,
) => OutfitSystemStatus;

export interface SystemReadinessResult {
    declared: boolean;
    requirements: string[];
    registryPath: string;
    satisfied: boolean;
    pendingChanges: number;
    status?: OutfitSystemStatus;
}

export async function checkSystemReadiness(
    rootDir: string,
    registry = "../captain-outfit-registry",
    getStatus: OutfitStatusProvider = getOutfitStatus,
): Promise<SystemReadinessResult> {
    const project = await readCaptainProject(rootDir);
    const requirements = project.system?.requires ?? [];
    const registryPath = path.resolve(rootDir, registry);

    if (requirements.length === 0) {
        return {
            declared: false,
            requirements,
            registryPath,
            satisfied: true,
            pendingChanges: 0,
        };
    }

    const status = getStatus(
        rootDir,
        requirements,
        registryPath,
    );

    return {
        declared: true,
        requirements,
        registryPath,
        satisfied: status.satisfied,
        pendingChanges: status.pendingChanges,
        status,
    };
}

export async function assertSystemReady(
    rootDir: string,
    registry = "../captain-outfit-registry",
    getStatus: OutfitStatusProvider = getOutfitStatus,
): Promise<SystemReadinessResult> {
    const readiness = await checkSystemReadiness(
        rootDir,
        registry,
        getStatus,
    );

    if (!readiness.satisfied) {
        throw new Error(
            `System dependencies are not satisfied: ${readiness.pendingChanges} change(s) pending. ` +
            "Run 'captain system plan', approve the plan, then apply it before building.",
        );
    }

    return readiness;
}