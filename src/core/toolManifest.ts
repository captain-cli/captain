import path from "node:path";
import { readJsonFile } from "./files.js";
import { getCaptainProjectPath, readCaptainProject } from "./manifest.js";
import type { CaptainProject } from "../types/manifest.js";

export const CAPTAIN_TOOL_MANIFEST_SCHEMA = "captain/tool-manifest/v1";

export interface ResolvedToolConfig<T extends object = Record<string, unknown>> {
    tool: string;
    path: string;
    config: T;
    inline: boolean;
}

interface CaptainToolManifest<T extends object = Record<string, unknown>> {
    schema: string;
    tool: string;
    config: T;
}

function validateRelativeReference(reference: string, fieldName: string): string {
    if (typeof reference !== "string" || !reference.trim()) {
        throw new Error(`${fieldName} must be a non-empty string`);
    }

    const normalized = reference.replace(/\\/g, "/");
    if (path.isAbsolute(normalized)) {
        throw new Error(`${fieldName} must be relative to the project root`);
    }

    const parts = normalized.split("/").filter(Boolean);
    if (parts.includes("..")) {
        throw new Error(`${fieldName} must remain inside the project root`);
    }

    return parts.join("/");
}

function resolveInsideProject(rootDir: string, reference: string): string {
    const root = path.resolve(rootDir);
    const target = path.resolve(root, reference);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
        throw new Error(`Manifest path escapes project root: ${reference}`);
    }
    return target;
}

export async function resolveToolConfig<T extends object = Record<string, unknown>>(
    rootDir: string,
    tool: string,
    options: { required?: boolean } = {},
): Promise<ResolvedToolConfig<T> | undefined> {
    if (!tool.trim()) {
        throw new Error("Captain tool name must be a non-empty string");
    }

    const project = await readCaptainProject(rootDir);
    const key = tool.trim();
    const inline = project[key as keyof CaptainProject] as unknown;
    const reference = project.manifests?.[key];

    if (inline !== undefined && reference !== undefined) {
        throw new Error(
            `Captain tool "${key}" is configured both inline and through manifests.${key}; choose one source of truth`,
        );
    }

    if (inline !== undefined) {
        if (typeof inline !== "object" || inline === null || Array.isArray(inline)) {
            throw new Error(`Captain manifest section "${key}" must be an object`);
        }
        return {
            tool: key,
            path: getCaptainProjectPath(rootDir),
            config: inline as T,
            inline: true,
        };
    }

    if (reference !== undefined) {
        const safeReference = validateRelativeReference(reference, `manifests.${key}`);
        const manifestPath = resolveInsideProject(rootDir, safeReference);
        const document = await readJsonFile<CaptainToolManifest<T>>(manifestPath);

        if (document.schema !== CAPTAIN_TOOL_MANIFEST_SCHEMA) {
            throw new Error(
                `Unsupported Captain tool manifest schema for "${key}": ${document.schema}`,
            );
        }
        if (document.tool !== key) {
            throw new Error(
                `Captain tool manifest ${manifestPath} belongs to "${document.tool}", not "${key}"`,
            );
        }
        if (typeof document.config !== "object" || document.config === null || Array.isArray(document.config)) {
            throw new Error(`Captain tool manifest config for "${key}" must be an object`);
        }

        return {
            tool: key,
            path: manifestPath,
            config: document.config,
            inline: false,
        };
    }

    if (options.required) {
        throw new Error(`Captain tool configuration "${key}" is required`);
    }
    return undefined;
}
