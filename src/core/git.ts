import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function getChangedFilesFromGit(base: string): Promise<string[]> {
    const result = await execFileAsync("git", [
        "diff",
        "--name-only",
        `${base}...HEAD`,
    ]);

    return result.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
}