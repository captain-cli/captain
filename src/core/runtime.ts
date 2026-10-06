const MINIMUM_NODE_MAJOR = 18;

export function parseNodeMajor(version: string): number | null {
    const match = /^v?(\d+)(?:\.|$)/.exec(version.trim());
    if (!match) {
        return null;
    }

    const major = Number.parseInt(match[1], 10);
    return Number.isFinite(major) ? major : null;
}

export function assertSupportedNodeVersion(version = process.version): void {
    const major = parseNodeMajor(version);

    if (major === null) {
        throw new Error(`Captain could not determine the Node.js version from: ${version}`);
    }

    if (major < MINIMUM_NODE_MAJOR) {
        throw new Error(
            `Captain requires Node.js >= ${MINIMUM_NODE_MAJOR}. Detected: Node.js ${version.replace(/^v/, "")}`,
        );
    }
}
