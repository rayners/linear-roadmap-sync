# linear-roadmap-sync

A skeleton TypeScript command line tool that reads Linear tickets, GitHub issues, and GitHub pull requests to generate a Markdown roadmap (defaulting to `ROADMAP.md`). The implementation intentionally focuses on structure so that real synchronization logic can be layered on later.

## Features

- Collects Linear tickets for a specific team using the official [`@linear/sdk`](https://linear.app/developers/sdk)
- Collects GitHub issues and pull requests through Octokit, authenticated by the `gh` CLI token
- Filters by Linear labels/tags and GitHub labels
- Renders a Markdown roadmap using a built-in template or a user-supplied template file
- Supports dry-run mode to preview the generated Markdown without writing to disk
- Non-destructive: the tool performs read-only API operations
- Handles pagination for large backlogs of issues and pull requests

## Prerequisites

- Node.js 18+
- [GitHub CLI (`gh`)](https://cli.github.com/) authenticated with access to the target repository (the CLI's stored token is reused for Octokit requests)
  - Install: `brew install gh` (macOS) or see [installation guide](https://github.com/cli/cli#installation)
  - Authenticate: `gh auth login`
- Linear API key with access to the target workspace
  - Create an API key at: https://linear.app/settings/api
  - Export as `LINEAR_API_KEY` environment variable or pass via `--linear-api-key` flag

## Installation

```bash
npm install
npm run build
npm link  # Creates global `linear-roadmap-sync` command
```

## Quick Start

1. **Set up your Linear API key:**
   ```bash
   export LINEAR_API_KEY="lin_api_..."
   ```

2. **Run a dry-run test:**
   ```bash
   linear-roadmap-sync \
     --linear-team FOU \
     --github-repo rayners/linear-roadmap-sync \
     --dry-run
   ```

3. **Generate a roadmap file:**
   ```bash
   linear-roadmap-sync \
     --linear-team FOU \
     --github-repo rayners/linear-roadmap-sync \
     --output-file ROADMAP.md
   ```

## Usage

```
linear-roadmap-sync --linear-team <TEAM> --github-repo <OWNER/REPO> [options]
```

### Required arguments

- `--linear-team <TEAM>` – Linear team identifier (id, key, or name)
- `--github-repo <OWNER/REPO>` – GitHub repository to read issues and pull requests from
- `--linear-api-key <KEY>` – Linear API key (optional when `LINEAR_API_KEY` env var is set)

### Optional arguments

- `--linear-tag <TAG>` – Only include Linear issues with the given tag (repeatable)
- `--github-tag <LABEL>` – Only include GitHub issues/PRs with the given label (repeatable)
- `--output-file <FILE>` – Destination Markdown file (defaults to `ROADMAP.md`)
- `--template-file <FILE>` – Path to a custom Handlebars-like template
- `--dry-run` – Print the generated Markdown instead of writing to disk

### Example

```bash
LINEAR_API_KEY=lin_api_key_here \
linear-roadmap-sync \
  --linear-team FOU \
  --linear-tag "roadmap" \
  --github-repo rayners/linear-roadmap-sync \
  --github-tag roadmap \
  --dry-run
```

## Template format

The default template renders three sections: Linear tickets, GitHub issues, and GitHub pull requests. Custom templates can use the same placeholder syntax as the default:

- `{{generatedAt}}` – ISO timestamp of generation
- `{{#each linearTickets}}...{{/each}}` – Iterate over tickets (fields: `identifier`, `title`, `url`)
- `{{#each githubIssues}}...{{/each}}` – Iterate over GitHub issues (fields: `number`, `title`, `url`)
- `{{#each githubPulls}}...{{/each}}` – Iterate over GitHub pull requests (fields: `number`, `title`, `url`)

## Development

- `npm run build` – Compile TypeScript to `dist/`
- `npm run lint` – Type-check the project (lightweight substitute for a linter)
- `npm run clean` – Remove build artifacts

## Roadmap

- Support richer template engines (e.g. Handlebars)
- Add automated tests and validation tooling
