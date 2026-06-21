import {
    createBumpRulesFromProject,
    createMasterManifestFromProject,
    readCaptainProject,
    writeBumpRules,
    writeMasterManifest,
} from "./manifest.js";

export interface SyncResult {
    masterManifestUpdated: boolean;
    bumpRulesUpdated: boolean;
}

export async function syncGeneratedManifests(rootDir: string): Promise<SyncResult> {
    const project = await readCaptainProject(rootDir);

    const masterManifest = createMasterManifestFromProject(project);
    const bumpRules = createBumpRulesFromProject(project);

    await writeMasterManifest(rootDir, masterManifest);
    await writeBumpRules(rootDir, bumpRules);

    return {
        masterManifestUpdated: true,
        bumpRulesUpdated: true,
    };
}