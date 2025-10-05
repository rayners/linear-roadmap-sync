# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A TypeScript CLI tool that generates Markdown roadmap files by aggregating Linear tickets, GitHub issues, and GitHub pull requests. The tool is intentionally structured as a skeleton implementation to allow synchronization logic to be added later. All operations are read-only and non-destructive.

## Core Architecture

### Data Flow
1. **Parallel Fetching** (src/index.ts:17-22): Linear tickets, GitHub issues, GitHub PRs, and templates are fetched concurrently using Promise.all
2. **Template Rendering** (src/template.ts): Simple mustache-style string replacement (intentionally lightweight, not using a full template engine)
3. **Output**: Either written to file or printed to stdout (dry-run mode)

### Module Responsibilities
- **src/linear.ts**: Linear SDK integration with team resolution and pagination handling
- **src/github.ts**: Octokit integration using gh CLI authentication with automatic pagination
- **src/template.ts**: Basic template loading and rendering with {{placeholder}} syntax
- **src/types.ts**: Shared TypeScript interfaces across modules
- **src/index.ts**: CLI orchestration using Commander.js

### Key Design Patterns

**Authentication Strategy**:
- Linear: API key via `--linear-api-key` flag or `LINEAR_API_KEY` environment variable
- GitHub: Reuses `gh` CLI authentication token (src/github.ts:8-23), with singleton Octokit instance (src/github.ts:25-48)

**Pagination Handling**:
- Linear: Custom `collectAllNodes` helper (src/linear.ts:10-19) for SDK's connection pattern
- GitHub: Octokit's built-in `paginate` method (src/github.ts:87, 120)

**Filtering Logic**:
- Linear tags: Requires ALL specified tags (AND logic) - src/linear.ts:64-69
- GitHub labels: Requires ALL specified labels (AND logic) - src/github.ts:72-76, 104
- Note: GitHub API uses OR for labels parameter, so local filtering is performed after fetch

**Team Resolution** (src/linear.ts:21-35):
Accepts team identifier in three formats: team ID, team key, or team name (case-insensitive)

## Common Commands

### Build and Type-Check
- `npm run build` - Compile TypeScript to dist/
- `npm run lint` - Type-check without emitting files (equivalent to `tsc --noEmit`)
- `npm run clean` - Remove dist/ directory

### Development
- `npm link` - Create global symlink for local testing of the CLI
- `ts-node src/index.ts` - Run CLI directly without building (requires dev dependencies)

### Running the CLI
```bash
linear-roadmap-sync \
  --linear-team FOU \
  --linear-tag roadmap \
  --github-repo owner/repo \
  --github-tag roadmap \
  --dry-run
```

## TypeScript Configuration Notes

- **Strict mode enabled**: All strict compiler options active (tsconfig.json:13)
- **Additional strictness**: `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` (tsconfig.json:14-15)
- **Module system**: NodeNext for ESM/CJS interop (tsconfig.json:6-7)
- **Target**: ES2022 for Node.js 18+ compatibility

## Prerequisites

- Node.js 18+
- GitHub CLI (`gh`) must be authenticated before running
- Linear API key with access to target workspace

## Important Constraints

- **Read-only operations**: Tool never modifies or deletes remote resources
- **Label filtering is AND logic**: All specified tags/labels must be present (differs from GitHub's default OR behavior)
- **Template engine is intentional**: Current implementation uses simple string replacement rather than a full template engine to keep the skeleton lightweight
