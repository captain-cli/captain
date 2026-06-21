import { promises as fs } from "node:fs";
import path from "node:path";

export interface ScanSuggestion {
    name: string;
    path: string;
    laneName: string;
    laneType: string;
    componentType: string;
}

interface KnownDirectoryRule {
    directoryName: string;
    laneName: string;
    laneType: string;
    componentType: string;
}

const KNOWN_DIRECTORY_RULES: KnownDirectoryRule[] = [
    {
        directoryName: "apis",
        laneName: "apis",
        laneType: "service-group",
        componentType: "api-group",
    },
    {
        directoryName: "api",
        laneName: "apis",
        laneType: "service-group",
        componentType: "api-group",
    },
    {
        directoryName: "services",
        laneName: "services",
        laneType: "service-group",
        componentType: "service-group",
    },
    {
        directoryName: "service",
        laneName: "services",
        laneType: "service-group",
        componentType: "service-group",
    },
    {
        directoryName: "database",
        laneName: "database",
        laneType: "database",
        componentType: "database",
    },
    {
        directoryName: "databases",
        laneName: "database",
        laneType: "database",
        componentType: "database",
    },
    {
        directoryName: "db",
        laneName: "database",
        laneType: "database",
        componentType: "database",
    },
    {
        directoryName: "config",
        laneName: "configuration",
        laneType: "configuration",
        componentType: "configuration",
    },
    {
        directoryName: "configuration",
        laneName: "configuration",
        laneType: "configuration",
        componentType: "configuration",
    },
    {
        directoryName: "interfaces",
        laneName: "interfaces",
        laneType: "frontend",
        componentType: "frontend-group",
    },
    {
        directoryName: "frontend",
        laneName: "frontend",
        laneType: "frontend",
        componentType: "frontend",
    },
    {
        directoryName: "dashboard",
        laneName: "dashboard",
        laneType: "frontend",
        componentType: "dashboard",
    },
    {
        directoryName: "system",
        laneName: "system",
        laneType: "system",
        componentType: "system-group",
    },
    {
        directoryName: "workers",
        laneName: "workers",
        laneType: "service-group",
        componentType: "worker-group",
    },
    {
        directoryName: "worker",
        laneName: "workers",
        laneType: "service-group",
        componentType: "worker-group",
    },
    {
        directoryName: "libs",
        laneName: "libraries",
        laneType: "library",
        componentType: "library-group",
    },
    {
        directoryName: "libraries",
        laneName: "libraries",
        laneType: "library",
        componentType: "library-group",
    },
    {
        directoryName: "packages",
        laneName: "packages",
        laneType: "package",
        componentType: "package-group",
    },
    {
        directoryName: "scripts",
        laneName: "tooling",
        laneType: "tooling",
        componentType: "script-group",
    },
    {
        directoryName: "tools",
        laneName: "tooling",
        laneType: "tooling",
        componentType: "tooling",
    },
];

const IGNORED_DIRECTORIES = new Set([
    ".git",
    ".github",
    ".captain",
    "manifest",
    "node_modules",
    "dist",
    "build",
    "coverage",
    "tmp",
    "temp",
]);

function toComponentName(directoryName: string): string {
    return directoryName
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function findRule(directoryName: string): KnownDirectoryRule | undefined {
    return KNOWN_DIRECTORY_RULES.find((rule) => rule.directoryName === directoryName);
}

export async function scanProject(rootDir: string): Promise<ScanSuggestion[]> {
    const entries = await fs.readdir(rootDir, {
        withFileTypes: true,
    });

    const suggestions: ScanSuggestion[] = [];

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }

        if (IGNORED_DIRECTORIES.has(entry.name)) {
            continue;
        }

        const rule = findRule(entry.name);

        if (!rule) {
            continue;
        }

        suggestions.push({
            name: toComponentName(entry.name),
            path: entry.name,
            laneName: rule.laneName,
            laneType: rule.laneType,
            componentType: rule.componentType,
        });
    }

    return suggestions.sort((a, b) => a.path.localeCompare(b.path));
}

export function formatScanSuggestions(suggestions: ScanSuggestion[]): string {
    if (suggestions.length === 0) {
        return "No component suggestions found.";
    }

    const lines: string[] = [];

    lines.push("Captain scan suggestions:");
    lines.push("");

    for (const suggestion of suggestions) {
        lines.push(`${suggestion.path}/`);
        lines.push(`  lane:      ${suggestion.laneName} (${suggestion.laneType})`);
        lines.push(`  component: ${suggestion.name} (${suggestion.componentType})`);
        lines.push("");
    }

    return lines.join("\n").trimEnd();
}