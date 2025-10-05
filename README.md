# linear-roadmap-sync

A skeleton TypeScript command line tool that reads Linear tickets, GitHub issues, and GitHub pull requests to generate a Markdown roadmap (defaulting to `ROADMAP.md`). The implementation intentionally focuses on structure so that real synchronization logic can be layered on later.

## Features

- Collects Linear tickets for a specific team using the official [`@linear/sdk`](https://linear.app/developers/sdk)
- Collects GitHub issues and pull requests through Octokit, authenticated by the `gh` CLI token
- Filters by Linear labels/tags and GitHub labels
- **Priority-based sorting**: Automatically sorts roadmap items by Linear priority (Urgent → High → Medium → Low → No Priority)
- **Workflow state grouping**: Groups issues by Linear workflow states (Started → Unstarted → Backlog) instead of team-specific status names
- **Optional GitHub issue creation**: Create GitHub issues for Linear tickets that don't have linked issues (opt-in via `--create-github-issues`)
- Renders a Markdown roadmap using a built-in template or a user-supplied template file
- Supports dry-run mode to preview the generated Markdown without writing to disk
- Non-destructive by default: read-only API operations (write operations only when explicitly enabled)
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
- `--github-pr-state <STATE>` – Filter GitHub PRs by state: `all`, `open`, `closed`, `merged` (defaults to `open`)
- `--output-file <FILE>` – Destination Markdown file (defaults to `ROADMAP.md`)
- `--template-file <FILE>` – Path to a custom Handlebars-like template
- `--create-github-issues` – Create GitHub issues for Linear tickets without linked issues (write operation)
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

## Priority Sorting

Linear issues are automatically sorted by priority within each workflow state section. Linear uses a numerical priority system where lower numbers indicate higher priority:

- **Priority 1 (Urgent)** – Critical issues requiring immediate attention
- **Priority 2 (High)** – Important issues to address soon
- **Priority 3 (Medium)** – Standard priority issues
- **Priority 4 (Low)** – Nice-to-have improvements
- **Priority 0 (No Priority)** or unset – Unprioritized items appear last

This ensures that the most important work is always visible at the top of each section in your roadmap.

## Workflow State Grouping

The roadmap groups issues by Linear's workflow states rather than team-specific status names. This makes the roadmap resilient to status name changes:

- **Started**: Issues in active development (typically "In Progress", "In Review", etc.)
- **Unstarted**: Issues planned for work (typically "Todo", "Ready", etc.)
- **Backlog**: Issues not yet prioritized or scheduled

The actual status name (e.g., "Todo", "In Progress") is shown in parentheses after each issue for reference.

**Note**: Completed and Canceled issues are excluded from the roadmap, similar to how merged PRs are filtered out.

## GitHub Issue Creation

Use the `--create-github-issues` flag to automatically create GitHub issues for Linear tickets that don't have linked GitHub issues:

```bash
linear-roadmap-sync \
  --linear-team FOU \
  --github-repo rayners/linear-roadmap-sync \
  --create-github-issues
```

**Behavior**:
- Only runs when the flag is explicitly set (opt-in)
- Skipped in `--dry-run` mode
- Creates issues with the Linear ticket title
- Includes Linear ticket URL, state, and priority in the GitHub issue body
- Applies the same labels specified via `--github-tag`
- Outputs the created GitHub issue URL
- **Manual step required**: You must manually link the created GitHub issue back to the Linear ticket as an attachment

**Important**: This is a write operation and will create real GitHub issues. Use with caution.

## Template format

The default template renders issues grouped by workflow state and sorted by priority. Custom templates can use these data structures:

- `{{generatedAt}}` – ISO timestamp of generation
- `{{#each mergedItems}}...{{/each}}` – Iterate over combined Linear/GitHub items (fields: `linearTicket`, `githubIssue`, `title`)
  - `linearTicket` fields: `identifier`, `title`, `url`, `state`, `workflowState`, `priority`
    - `workflowState` values: `'backlog'`, `'unstarted'`, `'started'`, `'completed'`, `'canceled'`, `'triage'`
    - `priority` values: `1` (Urgent), `2` (High), `3` (Medium), `4` (Low), `0` (No Priority), or `undefined`
  - `githubIssue` fields: `number`, `title`, `url`, `state`, `labels`
- `{{#each githubPulls}}...{{/each}}` – Iterate over GitHub pull requests (fields: `number`, `title`, `url`, `state`, `merged`)

### Custom Template Helpers

The template engine provides a custom Handlebars helper for conditional logic:

- `{{#if (eq a b)}}...{{/if}}` – Compare two values for equality

**Example**: Filter by workflow state:
```handlebars
{{#each mergedItems}}
  {{#if linearTicket}}
    {{#if (eq linearTicket.workflowState "started")}}
      - [{{linearTicket.identifier}}]({{linearTicket.url}}): {{title}}
    {{/if}}
  {{/if}}
{{/each}}
```

## Development

- `npm run build` – Compile TypeScript to `dist/`
- `npm run lint` – Type-check the project (lightweight substitute for a linter)
- `npm run clean` – Remove build artifacts

## Future Enhancements

- Automatic bidirectional linking between Linear and GitHub (requires Linear API write permissions)
- Add automated tests and validation tooling
