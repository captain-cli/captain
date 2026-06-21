export type BumpLevel = "patch" | "minor" | "major";

export function isBumpLevel(value: string): value is BumpLevel {
    return value === "patch" || value === "minor" || value === "major";
}

export function bumpVersion(version: string, level: BumpLevel): string {
    const parts = version.split(".").map((part) => Number(part));

    if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
        throw new Error(`Invalid semantic version: ${version}`);
    }

    const [major, minor, patch] = parts;

    if (level === "major") {
        return `${major + 1}.0.0`;
    }

    if (level === "minor") {
        return `${major}.${minor + 1}.0`;
    }

    return `${major}.${minor}.${patch + 1}`;
}