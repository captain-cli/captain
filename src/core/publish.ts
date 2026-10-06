import fs from "node:fs";
import path from "node:path";

import { readCaptainProject } from "./manifest.js";
import type {
    CaptainProject,
    CaptainPublishConfig,
    CaptainPublishDestination,
    CaptainGitHubReleaseDestination,
} from "../types/manifest.js";
import type { PackageFormat } from "./packagePipeline.js";

export interface PublishArtifact {
    format: PackageFormat;
    path: string;
    name: string;
    size: number;
}

export interface PublishDestinationPlan {
    name: string;
    provider: string;
    repository?: string;
    tag?: string;
    releaseName?: string;
    artifacts: PublishArtifact[];
}

export interface PublishPlan {
    projectName: string;
    projectVersion: string;
    packageOutputRoot: string;
    destinations: PublishDestinationPlan[];
}

export interface PublishOptions {
    destination?: string;
    formats?: PackageFormat[];
    dryRun?: boolean;
    token?: string;
}

export interface PublishResult {
    plan: PublishPlan;
    published: Array<{
        destination: string;
        provider: string;
        releaseUrl?: string;
        uploaded: string[];
    }>;
}

interface GitHubReleaseResponse {
    id: number;
    html_url?: string;
    upload_url?: string;
}

function requirePublish(project: CaptainProject): CaptainPublishConfig {
    if (!project.publish || !project.publish.destinations) {
        throw new Error("manifest.json is missing publish.destinations configuration");
    }
    if (Object.keys(project.publish.destinations).length === 0) {
        throw new Error("publish.destinations must contain at least one destination");
    }
    return project.publish;
}

function requirePackageOutputRoot(rootDir: string): string {
    return path.resolve(rootDir, ".captain/packages");
}

function isPackageArtifact(format: PackageFormat, filePath: string): boolean {
    if (format === "deb") return filePath.endsWith(".deb");
    return filePath.endsWith(".rpm");
}

function walkFiles(rootDir: string): string[] {
    if (!fs.existsSync(rootDir)) return [];
    const files: string[] = [];
    const stack = [rootDir];
    while (stack.length > 0) {
        const current = stack.pop()!;
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) stack.push(fullPath);
            else if (entry.isFile()) files.push(fullPath);
        }
    }
    return files.sort();
}

export function discoverPackageArtifacts(
    packageOutputRoot: string,
    formats: PackageFormat[] = ["deb", "rpm"],
): PublishArtifact[] {
    const artifacts: PublishArtifact[] = [];
    for (const format of formats) {
        const formatRoot = path.join(packageOutputRoot, format);
        for (const filePath of walkFiles(formatRoot)) {
            if (!isPackageArtifact(format, filePath)) continue;
            const stat = fs.statSync(filePath);
            artifacts.push({
                format,
                path: filePath,
                name: path.basename(filePath),
                size: stat.size,
            });
        }
    }
    return artifacts;
}

function selectedDestinations(
    publish: CaptainPublishConfig,
    requested?: string,
): Array<[string, CaptainPublishDestination]> {
    const entries = Object.entries(publish.destinations);
    if (!requested) return entries;
    const selected = entries.find(([name]) => name === requested);
    if (!selected) {
        throw new Error(`Publish destination is not configured: ${requested}`);
    }
    return [selected];
}

function githubTag(destination: CaptainGitHubReleaseDestination, version: string): string {
    return destination.tag ?? `v${version}`;
}

function githubReleaseName(destination: CaptainGitHubReleaseDestination, version: string): string {
    return destination.releaseName ?? githubTag(destination, version);
}

export async function createPublishPlan(
    rootDir: string,
    options: Pick<PublishOptions, "destination" | "formats"> = {},
): Promise<PublishPlan> {
    const project = await readCaptainProject(rootDir);
    const publish = requirePublish(project);
    const packageOutputRoot = requirePackageOutputRoot(rootDir);
    const artifacts = discoverPackageArtifacts(packageOutputRoot, options.formats ?? ["deb", "rpm"]);

    if (artifacts.length === 0) {
        throw new Error(`No publishable package artifacts found under ${packageOutputRoot}`);
    }

    const destinations = selectedDestinations(publish, options.destination).map(([name, destination]) => {
        if (destination.provider === "github-release") {
            if (typeof destination.repository !== "string" || destination.repository.length === 0) {
                throw new Error(`Publish destination ${name} requires repository for github-release`);
            }
            const githubDestination = destination as CaptainGitHubReleaseDestination;
            return {
                name,
                provider: githubDestination.provider,
                repository: githubDestination.repository,
                tag: githubTag(githubDestination, project.project.version),
                releaseName: githubReleaseName(githubDestination, project.project.version),
                artifacts,
            } satisfies PublishDestinationPlan;
        }

        return {
            name,
            provider: destination.provider,
            artifacts,
        } satisfies PublishDestinationPlan;
    });

    return {
        projectName: project.project.name,
        projectVersion: project.project.version,
        packageOutputRoot,
        destinations,
    };
}

function authToken(explicit?: string): string {
    const token = explicit ?? process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
    if (!token) {
        throw new Error("GitHub publish requires GH_TOKEN or GITHUB_TOKEN");
    }
    return token;
}

async function githubRequest(
    url: string,
    token: string,
    init: RequestInit = {},
): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/vnd.github+json");
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("X-GitHub-Api-Version", "2022-11-28");
    if (init.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    return fetch(url, { ...init, headers });
}

async function responseError(response: Response): Promise<string> {
    let detail = "";
    try {
        const body = await response.json() as { message?: string };
        detail = body.message ? `: ${body.message}` : "";
    } catch {
        // Keep the HTTP status as the useful error when GitHub does not return JSON.
    }
    return `${response.status} ${response.statusText}${detail}`;
}

async function ensureGitHubRelease(
    destination: CaptainGitHubReleaseDestination,
    version: string,
    token: string,
): Promise<GitHubReleaseResponse> {
    const repository = destination.repository;
    const tag = githubTag(destination, version);
    const encodedTag = encodeURIComponent(tag);
    const getResponse = await githubRequest(
        `https://api.github.com/repos/${repository}/releases/tags/${encodedTag}`,
        token,
    );

    if (getResponse.ok) {
        return await getResponse.json() as GitHubReleaseResponse;
    }
    if (getResponse.status !== 404) {
        throw new Error(`Unable to resolve GitHub release ${repository}@${tag}: ${await responseError(getResponse)}`);
    }

    const createResponse = await githubRequest(
        `https://api.github.com/repos/${repository}/releases`,
        token,
        {
            method: "POST",
            body: JSON.stringify({
                tag_name: tag,
                name: githubReleaseName(destination, version),
                draft: destination.draft ?? false,
                prerelease: destination.prerelease ?? false,
                generate_release_notes: destination.generateReleaseNotes ?? true,
            }),
        },
    );
    if (!createResponse.ok) {
        throw new Error(`Unable to create GitHub release ${repository}@${tag}: ${await responseError(createResponse)}`);
    }
    return await createResponse.json() as GitHubReleaseResponse;
}

async function uploadGitHubAsset(
    repository: string,
    releaseId: number,
    artifact: PublishArtifact,
    token: string,
): Promise<void> {
    const uploadUrl = `https://uploads.github.com/repos/${repository}/releases/${releaseId}/assets?name=${encodeURIComponent(artifact.name)}`;
    const data = fs.readFileSync(artifact.path);
    const response = await githubRequest(uploadUrl, token, {
        method: "POST",
        headers: {
            "Content-Type": "application/octet-stream",
            "Content-Length": String(data.length),
        },
        body: data,
    });
    if (response.status === 422) {
        throw new Error(`GitHub release asset already exists: ${artifact.name}`);
    }
    if (!response.ok) {
        throw new Error(`Unable to upload GitHub release asset ${artifact.name}: ${await responseError(response)}`);
    }
}

async function publishGitHubRelease(
    destinationName: string,
    destination: CaptainGitHubReleaseDestination,
    version: string,
    artifacts: PublishArtifact[],
    token: string,
): Promise<PublishResult["published"][number]> {
    const release = await ensureGitHubRelease(destination, version, token);
    for (const artifact of artifacts) {
        await uploadGitHubAsset(destination.repository, release.id, artifact, token);
    }
    return {
        destination: destinationName,
        provider: destination.provider,
        releaseUrl: release.html_url,
        uploaded: artifacts.map(artifact => artifact.name),
    };
}

export async function executePublish(
    rootDir: string,
    options: PublishOptions = {},
): Promise<PublishResult> {
    const project = await readCaptainProject(rootDir);
    const publish = requirePublish(project);
    const plan = await createPublishPlan(rootDir, options);

    if (options.dryRun) {
        return { plan, published: [] };
    }

    const published: PublishResult["published"] = [];
    for (const destinationPlan of plan.destinations) {
        const destination = publish.destinations[destinationPlan.name];
        if (destination.provider === "github-release") {
            if (typeof destination.repository !== "string" || destination.repository.length === 0) {
                throw new Error(`Publish destination ${destinationPlan.name} requires repository for github-release`);
            }
            published.push(await publishGitHubRelease(
                destinationPlan.name,
                destination as CaptainGitHubReleaseDestination,
                project.project.version,
                destinationPlan.artifacts,
                authToken(options.token),
            ));
            continue;
        }
        throw new Error(`Publish provider is not implemented: ${destination.provider}`);
    }

    return { plan, published };
}
