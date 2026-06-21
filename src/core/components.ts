import type {
    CaptainComponent,
    CaptainProject,
} from "../types/manifest.js";

export function upsertVersionLane(
    project: CaptainProject,
    options: {
        name: string;
        type: string;
        version: string;
        force?: boolean;
    },
): boolean {
    const exists = Boolean(project.versionLanes[options.name]);

    if (exists && !options.force) {
        return false;
    }

    project.versionLanes[options.name] = {
        type: options.type,
        version: options.version,
    };

    return true;
}

export function upsertComponent(
    project: CaptainProject,
    component: CaptainComponent,
    force = false,
): boolean {
    const existingIndex = project.components.findIndex(
        (existingComponent) => existingComponent.name === component.name,
    );

    if (existingIndex >= 0 && !force) {
        return false;
    }

    if (existingIndex >= 0) {
        project.components[existingIndex] = component;
    } else {
        project.components.push(component);
    }

    return true;
}