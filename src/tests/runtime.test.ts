import assert from "node:assert/strict";
import test from "node:test";

import { assertSupportedNodeVersion, parseNodeMajor } from "../core/runtime.js";

test("parses Node.js major versions", () => {
    assert.equal(parseNodeMajor("v16.19.0"), 16);
    assert.equal(parseNodeMajor("18.20.8"), 18);
    assert.equal(parseNodeMajor("v22.22.2"), 22);
});

test("accepts the minimum supported Node.js runtime", () => {
    assert.doesNotThrow(() => assertSupportedNodeVersion("v18.0.0"));
});

test("accepts newer Node.js runtimes", () => {
    assert.doesNotThrow(() => assertSupportedNodeVersion("v22.22.2"));
});

test("rejects Node.js 16 with a readable error", () => {
    assert.throws(
        () => assertSupportedNodeVersion("v16.19.0"),
        /Captain requires Node\.js >= 18\. Detected: Node\.js 16\.19\.0/,
    );
});

test("rejects an unreadable Node.js version", () => {
    assert.throws(
        () => assertSupportedNodeVersion("unknown"),
        /could not determine the Node\.js version/,
    );
});
