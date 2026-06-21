# Captain Usage Guide

Captain is a CLI tool for generating and maintaining **Captain's Manifest** files inside projects.

It supports two main project styles:

1. **Module/app projects** — one versionable app/package/tool.
2. **Structured projects** — multiple lanes such as `apis`, `services`, `database`, `dashboard`, etc.

Captain's goal is to keep project versioning, component ownership, generated bump rules, and release-facing manifests consistent without hardcoding those rules into scripts, GitHub Actions, or application code.

---

## Core Concepts

### Project

The project is the top-level product or repository.

```json
{
  "name": "module-app",
  "type": "app",
  "version": "1.0.0"
}
```

The project version represents the full project or release bundle. It does not have to change every time an individual component changes.

### Version Lane

A version lane is an independently versioned track within the project.

Examples:

```text
app
apis
services
database
dashboard
audioEngine
configuration
```

A lane lets part of a project move forward without forcing the entire project version to move.

### Component

A component is a folder, app, service, package, database manifest group, or logical project area that belongs to a version lane.

```json
{
  "name": "apis",
  "type": "api-group",
  "path": "apis",
  "versionLane": "apis"
}
```

This means changes under `apis/` belong to the `apis` version lane.

---

## Generated Files

Captain creates a `manifest/` directory inside the target project.

```text
manifest/
├── captain.project.json
├── master_manifest.json
└── bump_rules.json
```

### `captain.project.json`

This is the source project manifest.

It tracks project metadata, version lanes, components, and component-to-lane ownership.

### `master_manifest.json`

This is the release-facing manifest generated from `captain.project.json`.

Example:

```json
{
  "name": "tight-monolith",
  "version": "1.0.0",
  "components": {
    "apis": {
      "version": "1.0.1"
    },
    "database": {
      "version": "1.0.0"
    },
    "services": {
      "version": "1.0.1"
    }
  }
}
```

### `bump_rules.json`

This is generated from lanes/components in `captain.project.json`.

It tells Captain which changed file paths should bump which version lanes.

```json
{
  "schema": "captain/bump-rules/v1",
  "defaultBump": "patch",
  "lanes": {
    "apis": {
      "type": "service-group",
      "versionPath": "components.apis.version",
      "paths": [
        "apis/"
      ]
    }
  }
}
```

`bump_rules.json` is generated helper data, not the primary source of truth.

---

## Project Modes

### Module/App Mode

Use this for a single app, CLI, package, tool, or small service.

Example project:

```text
module-app/
├── src/
├── package.json
└── README.md
```

Initialize with:

```bash
captain init --name module-app --type app --version 1.0.0 --module
```

This creates one default lane:

```text
app
```

and one component:

```text
app -> .
```

For module/app mode, Captain treats `.` as the project root but ignores generated/build/dependency folders such as:

```text
manifest/
node_modules/
dist/
build/
coverage/
.git/
.captain/
tmp/
temp/
```

So changes to normal project files bump `app`, while generated files do not.

### Structured Project Mode

Use this for projects with multiple top-level areas.

Example project:

```text
tight-monolith/
├── apis/
├── services/
└── database/
```

Initialize:

```bash
captain init --name tight-monolith --type monolith --version 1.0.0
```

Scan and apply detected lanes/components:

```bash
captain scan --apply
```

Captain detects common folders such as:

```text
apis/
services/
database/
config/
interfaces/
system/
packages/
scripts/
tools/
```

and turns them into lanes/components.

---

## Installation and Local Development

From the Captain repo:

```bash
npm install
npm run build
```

Run the compiled CLI directly:

```bash
node dist/cli.js --help
```

Or, because the build marks the CLI executable:

```bash
./dist/cli.js --help
```

During development, from another test project inside `test-projects/`, use relative paths:

```bash
../../dist/cli.js --help
```

The package exposes the CLI command:

```json
"bin": {
  "captain": "./dist/cli.js"
}
```

After linking locally:

```bash
npm link
```

you can run:

```bash
captain --help
```

---

## Node Version

Captain is intended for Node 22.

Recommended `.nvmrc`:

```text
22
```

Use:

```bash
nvm use
node -v
```

Expected:

```text
v22.x.x
```

If the wrong Node version appears, check for aliases:

```bash
type -a node
```

If needed:

```bash
unalias node
hash -r
node -v
```

---

## Command Reference

### `captain init`

Initialize Captain's Manifest in the current project.

```bash
captain init --name <name> --type <type> --version <version>
```

Options:

```text
--name <name>          Project name
--type <type>          Project type, default: monolith
--version <version>    Initial project version, default: 1.0.0
--home-page <url>      Optional project home page
--module               Initialize as a single app/module project
--force                Overwrite existing manifest files
```

Examples:

```bash
captain init --name tight-monolith --type monolith --version 1.0.0
captain init --name module-app --type app --version 1.0.0 --module
```

---

### `captain scan`

Scan project folders and suggest lanes/components.

```bash
captain scan
```

Apply detected suggestions:

```bash
captain scan --apply
```

Options:

```text
--apply                Apply detected suggestions
--force                Overwrite existing lanes/components when applying
--version <version>    Initial version for newly detected lanes, default: 1.0.0
--no-generate          Do not regenerate derived manifest files after applying
```

---

### `captain lane add`

Add a version lane.

```bash
captain lane add <name> --type <type> --version <version>
```

Example:

```bash
captain lane add apis --type service-group --version 1.0.0
```

---

### `captain lane list`

List version lanes.

```bash
captain lane list
```

Example output:

```text
apis (service-group) 1.0.0
database (database) 1.0.0
services (service-group) 1.0.0
```

---

### `captain component add`

Add a project component.

```bash
captain component add <name> --type <type> --path <path> --lane <lane>
```

Example:

```bash
captain component add apis --type api-group --path apis --lane apis
```

The referenced lane must already exist.

---

### `captain component list`

List project components.

```bash
captain component list
```

Example output:

```text
apis (api-group) apis -> apis
database (database) database -> database
services (service-group) services -> services
```

---

### `captain generate`

Regenerate derived manifest files from `captain.project.json`.

```bash
captain generate
```

Generated files:

```text
manifest/master_manifest.json
manifest/bump_rules.json
```

---

### `captain validate`

Validate Captain manifest files.

```bash
captain validate
```

Validation checks include:

- manifest files exist
- project metadata exists
- versions are valid semantic versions
- components reference existing lanes
- component paths exist
- `master_manifest.json` is in sync
- `bump_rules.json` is in sync

Expected success:

```text
Captain manifest validation passed.
```

Expected drift failure:

```text
Captain manifest validation failed:
- master_manifest.json is out of sync. Run: captain generate
```

---

### `captain status`

Show a readable project summary.

```bash
captain status
```

Example output:

```text
Project: tight-monolith
Type:    monolith
Version: 1.0.0

Version lanes:
- apis: 1.0.1 (service-group)
- database: 1.0.0 (database)
- services: 1.0.1 (service-group)

Components:
- apis: apis (api-group) -> apis
- database: database (database) -> database
- services: services (service-group) -> services

Validation: passed
```

---

### `captain analyze-bumps`

Analyze changed files and produce a bump plan.

```bash
captain analyze-bumps --changed-files <path>
```

or with git:

```bash
captain analyze-bumps --base origin/main
```

Options:

```text
--base <base>               Git base ref, default: origin/main
--changed-files <path>      File containing changed file paths
--output <output>           Output bump plan path
```

Example changed files:

```text
apis/route.ts
services/worker.ts
database/schema.sql
docs/readme.md
```

Example command:

```bash
captain analyze-bumps --changed-files /tmp/captain-changed-files.txt
```

Example output:

```json
{
  "shouldBump": true,
  "bumps": {
    "apis": "patch",
    "services": "patch",
    "database": "patch"
  },
  "matches": {
    "apis": [
      "apis/route.ts"
    ],
    "services": [
      "services/worker.ts"
    ],
    "database": [
      "database/schema.sql"
    ]
  },
  "changedFiles": [
    "apis/route.ts",
    "services/worker.ts",
    "database/schema.sql",
    "docs/readme.md"
  ]
}
```

Write the plan to a file:

```bash
captain analyze-bumps \
  --changed-files /tmp/captain-changed-files.txt \
  --output /tmp/captain-bump-plan.json
```

---

### `captain bump`

Apply version bumps manually or from a bump plan.

Manual bump:

```bash
captain bump services minor
```

Plan-based bump:

```bash
captain bump --plan /tmp/captain-bump-plan.json
```

Bump levels:

```text
patch
minor
major
```

Example output:

```text
Captain applied version bumps:
- apis: 1.0.0 -> 1.0.1 (patch)
- services: 1.0.0 -> 1.0.1 (patch)
```

`captain bump` updates:

```text
manifest/captain.project.json
manifest/master_manifest.json
manifest/bump_rules.json
```

Generated files are synced automatically after bumping.

---

## Module/App Project Workflow

Use this for one-app or one-package projects.

Example setup:

```bash
mkdir -p module-app/src
cd module-app

touch package.json
touch README.md
touch src/index.ts
```

Initialize:

```bash
captain init --name module-app --type app --version 1.0.0 --module
```

Validate:

```bash
captain validate
```

Check status:

```bash
captain status
```

Expected status:

```text
Project: module-app
Type:    app
Version: 1.0.0

Version lanes:
- app: 1.0.0 (app)

Components:
- app: . (app) -> app

Validation: passed
```

Analyze changes:

```bash
cat > /tmp/captain-module-changed-files.txt <<'EOF'
src/index.ts
package.json
README.md
manifest/master_manifest.json
dist/cli.js
node_modules/foo/index.js
EOF

captain analyze-bumps --changed-files /tmp/captain-module-changed-files.txt
```

Expected output:

```json
{
  "shouldBump": true,
  "bumps": {
    "app": "patch"
  },
  "matches": {
    "app": [
      "src/index.ts",
      "package.json",
      "README.md"
    ]
  },
  "changedFiles": [
    "src/index.ts",
    "package.json",
    "README.md",
    "manifest/master_manifest.json",
    "dist/cli.js",
    "node_modules/foo/index.js"
  ]
}
```

Apply bump:

```bash
captain analyze-bumps \
  --changed-files /tmp/captain-module-changed-files.txt \
  --output /tmp/captain-module-bump-plan.json

captain bump --plan /tmp/captain-module-bump-plan.json
captain validate
captain status
```

Expected:

```text
Captain applied version bumps:
- app: 1.0.0 -> 1.0.1 (patch)
Captain manifest validation passed.
```

---

## Structured Project Workflow

Use this for projects with multiple top-level areas.

Example setup:

```bash
mkdir -p tight-monolith/apis
mkdir -p tight-monolith/services
mkdir -p tight-monolith/database

cd tight-monolith
```

Initialize:

```bash
captain init --name tight-monolith --type monolith --version 1.0.0
```

Scan:

```bash
captain scan
```

Apply:

```bash
captain scan --apply
```

Because `scan --apply` auto-generates derived files, you can validate immediately:

```bash
captain validate
captain status
```

Expected status:

```text
Project: tight-monolith
Type:    monolith
Version: 1.0.0

Version lanes:
- apis: 1.0.0 (service-group)
- database: 1.0.0 (database)
- services: 1.0.0 (service-group)

Components:
- apis: apis (api-group) -> apis
- database: database (database) -> database
- services: services (service-group) -> services

Validation: passed
```

Analyze changes:

```bash
cat > /tmp/captain-tight-changed-files.txt <<'EOF'
apis/route.ts
services/worker.ts
EOF

captain analyze-bumps \
  --changed-files /tmp/captain-tight-changed-files.txt \
  --output /tmp/captain-tight-bump-plan.json
```

Apply bump:

```bash
captain bump --plan /tmp/captain-tight-bump-plan.json
captain validate
captain status
```

Expected:

```text
Captain applied version bumps:
- apis: 1.0.0 -> 1.0.1 (patch)
- services: 1.0.0 -> 1.0.1 (patch)
```

The `database` lane does not bump unless a changed file matches `database/`.

---

## Recommended Development Loop

For module/app projects:

```bash
captain init --name my-app --type app --version 1.0.0 --module
captain validate
captain status
```

For structured projects:

```bash
captain init --name my-project --type monolith --version 1.0.0
captain scan --apply
captain validate
captain status
```

For bumping:

```bash
captain analyze-bumps --changed-files /tmp/changed-files.txt --output /tmp/bump-plan.json
captain bump --plan /tmp/bump-plan.json
captain validate
captain status
```

---

## Current Verified Behavior

Captain has been verified against two patterns.

### `tight-monolith`

Structure:

```text
tight-monolith/
├── apis/
├── database/
└── services/
```

Confirmed:

- `scan --apply` detects all three folders
- generated manifests validate
- changed files under `apis/` bump `apis`
- changed files under `services/` bump `services`
- untouched `database` lane does not bump
- project version stays unchanged

### `module-app`

Structure:

```text
module-app/
├── src/
├── package.json
└── README.md
```

Confirmed:

- `init --module` creates `app` lane/component
- root path matching works
- generated files are ignored
- build/dependency folders are ignored
- source/package/readme changes bump `app`
- project version stays unchanged

---

## Future Enhancements

Potential next improvements:

### Infer project name

Allow:

```bash
captain init --module
```

to infer project name from the current directory.

### Auto-scan during init

Allow:

```bash
captain init --scan
```

to bootstrap structured projects with fewer commands.

### JSON output mode

Useful for automation:

```bash
captain status --json
captain scan --json
captain validate --json
captain analyze-bumps --json
```

### GitHub Actions integration

Example release flow:

```text
checkout
install Captain
captain validate
captain analyze-bumps --base origin/main --output .captain/bump-plan.json
captain bump --plan .captain/bump-plan.json
captain validate
commit manifest changes
```

### Type registries

Captain can maintain known lane/component types:

```text
app
api-group
service-group
database
frontend
dashboard
configuration
native-service
library
tooling
```

Eventually these can be extensible by project.

---

## Philosophy

Captain should keep project structure knowledge in manifests, not in scripts.

The CLI should own the process of creating and maintaining:

- project manifests
- version lanes
- component mappings
- bump rules
- release-facing manifests

GitHub Actions and other automation should call Captain rather than duplicating Captain logic.

Captain's Manifest is the project map. Captain is the tool that maintains it.
