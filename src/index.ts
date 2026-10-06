/**
 * Captain orchestration engine.
 *
 * The user-facing executable lives in @captain/cli. These namespaces expose
 * Captain's orchestration capabilities without coupling consumers to terminal UX.
 */
export * as manifest from "./core/manifest.js";
export * as projectContext from "./core/projectContext.js";
export * as runtime from "./core/runtime.js";
export * as buildManifest from "./core/buildManifest.js";
export * as buildRunner from "./core/buildRunner.js";
export * as buildPackager from "./core/buildPackager.js";
export * as buildTarget from "./core/buildTarget.js";
export * as systemReadiness from "./core/systemReadiness.js";
export * as packagePipeline from "./core/packagePipeline.js";
export * as publish from "./core/publish.js";
export * as provision from "./core/provision.js";
export * as validator from "./core/validator.js";
