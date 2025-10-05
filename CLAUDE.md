# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A TypeScript CLI tool that generates Markdown roadmap files by aggregating Linear tickets, GitHub issues, and GitHub pull requests. The tool is intentionally structured as a skeleton implementation to allow synchronization logic to be added later. All operations are read-only and non-destructive.

## Core Architecture

### Data Flow
1. **Environment Setup** (src/index.ts:13): Dotenv loads `.env` file for automatic `LINEAR_API_KEY` configuration
2. **Parallel Fetching** (src/index.ts:21-26): Linear tickets, GitHub issues, GitHub PRs, and templates are fetched concurrently using Promise.all
3. **PR State Filtering** (src/index.ts:28-35): Filter PRs by state (open/closed/merged/all) based on CLI flag
4. **Issue Linking** (src/index.ts:37-61): Merge Linear tickets with linked GitHub issues into unified roadmap items
5. **Template Rendering** (src/template.ts:32-42): Handlebars compiles and renders template with security options (strict mode, assumeObjects)
6. **Output**: Either written to file or printed to stdout (dry-run mode)

### Module Responsibilities
- **src/linear.ts**: Linear SDK integration with team resolution, pagination handling, and attachment fetching
- **src/github.ts**: Octokit integration using gh CLI authentication with automatic pagination
- **src/template.ts**: Handlebars template loading and rendering with security configuration
- **src/types.ts**: Shared TypeScript interfaces including discriminated unions for merged items
- **src/index.ts**: CLI orchestration using Commander.js, dotenv, and issue linking logic

### Key Design Patterns

**Authentication Strategy**:
- **Dotenv Integration** (src/index.ts:13): Automatically loads `.env` file at startup for easy API key management
- **Linear**: API key via `--linear-api-key` flag or `LINEAR_API_KEY` environment variable (loaded from `.env`)
- **GitHub**: Reuses `gh` CLI authentication token (src/github.ts:8-23), with singleton Octokit instance (src/github.ts:25-48)

**Pagination Handling**:
- Linear: Custom `collectAllNodes` helper (src/linear.ts:10-19) for SDK's connection pattern
- GitHub: Octokit's built-in `paginate` method (src/github.ts:87, 120)

**Filtering Logic**:
- Linear tags: Requires ALL specified tags (AND logic) - src/linear.ts:64-69
- GitHub labels: Requires ALL specified labels (AND logic) - src/github.ts:72-76, 104
- Note: GitHub API uses OR for labels parameter, so local filtering is performed after fetch

**Team Resolution** (src/linear.ts:21-35):
Accepts team identifier in three formats: team ID, team key, or team name (case-insensitive)

**Linear/GitHub Issue Linking** (src/index.ts:37-61):
- Linear tickets with GitHub issue attachments are automatically detected via URL pattern matching
- Linked items are merged into single roadmap entries displaying both identifiers
- URL validation uses regex: `/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/`
- Supports repository names with dots and special characters
- Unlinked GitHub issues appear as separate entries

**PR State Filtering** (src/index.ts:28-35):
- Filter by `open`, `closed`, `merged`, or `all` via `--github-pr-state` flag
- Default: `open` (excludes merged PRs)
- Merged PRs detected by `merged` field, not state alone

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
  --github-pr-state open \
  --dry-run
```

**Key Options:**
- `--github-pr-state <state>` - Filter PRs by state: `open` (default), `closed`, `merged`, or `all`
- `--dry-run` - Preview output without writing to file
- `--output-file <file>` - Specify output location (default: ROADMAP.md)
- `--template-file <file>` - Use custom Handlebars template

## TypeScript Configuration Notes

- **Strict mode enabled**: All strict compiler options active (tsconfig.json:13)
- **Additional strictness**: `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` (tsconfig.json:14-15)
- **Module system**: NodeNext for ESM/CJS interop (tsconfig.json:6-7)
- **Target**: ES2022 for Node.js 18+ compatibility

## Prerequisites

- Node.js 18+
- GitHub CLI (`gh`) must be authenticated before running
- Linear API key with access to target workspace (can be configured via `.env` file)

## Dependencies

- **@linear/sdk**: Official Linear API client
- **@octokit/rest**: GitHub REST API client
- **commander**: CLI argument parsing
- **dotenv**: Environment variable loading from `.env` files
- **handlebars**: Template engine for customizable output

## Important Constraints

- **Read-only operations**: Tool never modifies or deletes remote resources
- **Label filtering is AND logic**: All specified tags/labels must be present (differs from GitHub's default OR behavior)
- **Template engine**: Uses Handlebars for full template support including conditionals and nested object access
- **Issue linking**: Linear tickets with GitHub issue attachments are automatically merged in roadmap output
