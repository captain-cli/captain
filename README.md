# Captain

Captain is a CLI tool for generating and maintaining **Captain's Manifest** files inside monolithic or multi-component projects.

Captain helps projects define:

- project metadata
- version lanes
- components
- generated master manifests
- generated bump rules
- version bump analysis

The goal is to avoid hardcoding version ownership rules inside scripts, GitHub Actions, or individual applications.

---

## Package

```bash
@captain/manifest
```

## CLI

```bash
captain
```

---

## Install

For local development inside this repository:

```bash
npm install
npm run build
```

Run the CLI in development mode:

```bash
npm run dev -- --help
```

Run the compiled CLI:

```bash
node dist/cli.js --help
```

---

## Intended Usage Inside a Project

Inside a project repository:

```bash
captain init --name my-project --type monolith --version 1.0.0
```

Captain will generate:

```text
manifest/
├── captain.project.json
├── master_manifest.json
└── bump_rules.json
```

---

## Core Concepts

### Project

The project is the top-level product or repository.

Example:

```json
{
  "name": "crispy-disco",
  "type": "monolith",
  "version": "1.0.5"
}
```

### Version Lane

A version lane is a named version track.

Examples:

```text
configuration
database
apis
dashboard
audioEngine
```

A version lane lets a large project evolve in sections without forcing every change to bump the full project version.

### Component

A component is a folder, service, app, database manifest group, package, tool, or system area that belongs to a version lane.

Examples:

```text
apis/                  -> apis version lane
database/              -> database version lane
interfaces/dashboard/  -> dashboard version lane
```

---

## Generated Files

Captain is responsible for generating and maintaining project manifest files.

```text
manifest/
├── captain.project.json
├── master_manifest.json
└── bump_rules.json
```

### `captain.project.json`

The source project manifest used by Captain.

It describes the project, version lanes, and components.

### `master_manifest.json`

The release-facing manifest.

Example:

```json
{
  "name": "crispy-disco",
  "home-page": "crispydisco.com",
  "version": "1.0.5",
  "components": {
    "configuration": {
      "version": "1.2.384"
    },
    "database": {
      "version": "1.2.384"
    },
    "apis": {
      "version": "1.0.5"
    },
    "dashboard": {
      "version": "1.0.5"
    },
    "audioEngine": {
      "version": "1.0.5"
    }
  }
}
```

### `bump_rules.json`

A generated helper file used to analyze changed files and determine which version lanes should bump.

The goal is for this file to be generated from Captain's project/component definitions instead of hand-maintained.

---

## Planned Commands

```bash
captain init
captain scan
captain lane add
captain component add
captain generate
captain analyze-bumps
captain bump
captain validate
```

---

## Command Goals

### `captain init`

Initialize Captain's Manifest inside a project.

Example:

```bash
captain init --name simple-monolith --type monolith --version 1.0.0
```

Expected generated structure:

```text
manifest/
├── captain.project.json
├── master_manifest.json
└── bump_rules.json
```

### `captain lane add`

Add a version lane.

Example:

```bash
captain lane add apis --type service-group --version 1.0.0
```

### `captain component add`

Add a project component and assign it to a version lane.

Example:

```bash
captain component add apis --path apis --lane apis --type api-group
```

### `captain generate`

Generate derived manifest files from `captain.project.json`.

Example outputs:

```text
manifest/master_manifest.json
manifest/bump_rules.json
```

### `captain scan`

Scan the project structure and suggest possible components.

Example project:

```text
simple-monolith/
├── apis/
├── services/
└── database/
```

Suggested components:

```text
apis/      -> api-group
services/  -> service-group
database/  -> database
```

### `captain analyze-bumps`

Analyze changed files and produce a bump plan.

Example:

```bash
captain analyze-bumps --base origin/main
```

Example output:

```json
{
  "shouldBump": true,
  "bumps": {
    "apis": "patch",
    "database": "patch"
  },
  "matches": {
    "apis": [
      "apis/media-api/routes/channel-guide.ts"
    ],
    "database": [
      "database/manifests/media.json"
    ]
  }
}
```

### `captain bump`

Apply version bumps manually or from a generated bump plan.

Examples:

```bash
captain bump apis patch
captain bump database patch
captain bump --plan .captain/bump-plan.json
```

### `captain validate`

Validate Captain manifest files.

Validation should check:

- required files exist
- version lanes are valid
- components reference existing lanes
- component paths are valid
- generated bump rules match the project manifest
- version values are valid semantic versions

---

## Development Scripts

```bash
npm run dev -- --help
npm run build
npm run start -- --help
npm run clean
npm run check
```

---

## Initial Test Project

The first development target is a small monolithic project:

```text
simple-monolith/
├── apis/
├── services/
└── database/
```

Captain should support this flow:

```bash
captain init --name simple-monolith --type monolith --version 1.0.0

captain lane add apis --type service-group --version 1.0.0
captain lane add services --type service-group --version 1.0.0
captain lane add database --type database --version 1.0.0

captain component add apis --path apis --lane apis --type api-group
captain component add services --path services --lane services --type service-group
captain component add database --path database --lane database --type database

captain generate
captain validate
```

Expected generated release manifest:

```json
{
  "name": "simple-monolith",
  "version": "1.0.0",
  "components": {
    "apis": {
      "version": "1.0.0"
    },
    "services": {
      "version": "1.0.0"
    },
    "database": {
      "version": "1.0.0"
    }
  }
}
```

---

## Design Principle

Captain should avoid hardcoded project knowledge.

The CLI should own the process of creating and updating:

- project manifests
- version lanes
- component mappings
- bump rules
- master manifests

GitHub Actions and other automation should call Captain instead of duplicating Captain's logic.

---

## Current Status

Captain is in early development.

The immediate goal is to build enough CLI functionality to initialize and manage the small `simple-monolith` test project before applying the pattern to Crispy Disco.
