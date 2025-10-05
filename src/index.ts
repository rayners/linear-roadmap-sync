#!/usr/bin/env node
import { config } from 'dotenv';
import { Command } from 'commander';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createGitHubIssue, fetchGitHubIssues, fetchGitHubPullRequests } from './github';
import { fetchLinearTickets } from './linear';
import { loadTemplate, renderTemplate } from './template';
import { MergedRoadmapItem, SyncOptions, TemplateContext } from './types';

// Load .env file if present
config();

function collect(value: string, previous: string[]): string[] {
  if (!value) return previous;
  return [...previous, value];
}

// GitHub issue URL pattern used for detecting linked issues
const GITHUB_ISSUE_URL_PATTERN = /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/;

async function run(options: SyncOptions): Promise<void> {
  const [allLinearTickets, githubIssues, allGithubPulls, template] = await Promise.all([
    fetchLinearTickets(options.linearTeam, options.linearTags, options.linearApiKey),
    fetchGitHubIssues(options.githubRepo, options.githubTags),
    fetchGitHubPullRequests(options.githubRepo, options.githubTags),
    loadTemplate(options.templateFile),
  ]);

  // Filter out completed and canceled Linear tickets
  const linearTickets = allLinearTickets.filter((ticket) => {
    const state = ticket.workflowState;
    return state !== 'completed' && state !== 'canceled';
  });

  // Filter PRs by state
  const githubPulls = allGithubPulls.filter((pr) => {
    if (options.githubPrState === 'all') return true;
    if (options.githubPrState === 'open') return pr.state === 'open' && !pr.merged;
    if (options.githubPrState === 'closed') return pr.state === 'closed' && !pr.merged;
    if (options.githubPrState === 'merged') return pr.merged === true;
    return true;
  });

  // Create GitHub issues for Linear tickets without links (if requested)
  let updatedGithubIssues = [...githubIssues];
  if (options.createGithubIssues && !options.dryRun) {
    // Find tickets without GitHub links
    const ticketsNeedingIssues = linearTickets.filter((ticket) => {
      const hasGithubLink = ticket.attachments?.some((att) => GITHUB_ISSUE_URL_PATTERN.test(att.url));
      return !hasGithubLink;
    });

    // Create issues in parallel with error handling
    const issueCreationPromises = ticketsNeedingIssues.map(async (ticket) => {
      try {
        process.stdout.write(`Creating GitHub issue for ${ticket.identifier}: ${ticket.title}\n`);
        const body = `Linear ticket: ${ticket.url}\n\nState: ${ticket.state ?? 'Unknown'}\nPriority: ${ticket.priority ?? 'None'}`;
        const newIssue = await createGitHubIssue(
          options.githubRepo,
          ticket.title,
          body,
          options.githubTags
        );
        process.stdout.write(`  Created: ${newIssue.url}\n`);
        process.stdout.write(`  Note: Link this GitHub issue back to Linear ticket manually at ${ticket.url}\n`);
        return newIssue;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`  Failed to create issue for ${ticket.identifier}: ${message}\n`);
        return null;
      }
    });

    const createdIssues = await Promise.all(issueCreationPromises);
    const successfulIssues = createdIssues.filter((issue): issue is NonNullable<typeof issue> => issue !== null);
    updatedGithubIssues.push(...successfulIssues);
  }

  // Merge Linear tickets with linked GitHub issues
  const linkedIssueUrls = new Set<string>();
  const mergedItems: MergedRoadmapItem[] = linearTickets.map((ticket) => {
    // Check if this Linear ticket has a GitHub issue attachment
    const githubAttachment = ticket.attachments?.find((att) =>
      GITHUB_ISSUE_URL_PATTERN.test(att.url)
    );

    if (githubAttachment) {
      // Find matching GitHub issue by URL
      const linkedIssue = updatedGithubIssues.find((issue) => issue.url === githubAttachment.url);
      if (linkedIssue) {
        linkedIssueUrls.add(linkedIssue.url);
        return { linearTicket: ticket, githubIssue: linkedIssue, title: ticket.title };
      }
    }

    return { linearTicket: ticket, title: ticket.title };
  });

  // Add unlinked GitHub issues
  const unlinkedIssues = updatedGithubIssues.filter((issue) => !linkedIssueUrls.has(issue.url));
  unlinkedIssues.forEach((issue) => {
    mergedItems.push({ githubIssue: issue, title: issue.title });
  });

  // Sort by priority (lower priority value = higher priority)
  // Items with priority=0 or undefined appear last
  mergedItems.sort((a, b) => {
    const aPriority = a.linearTicket?.priority;
    const bPriority = b.linearTicket?.priority;

    // Treat priority=0 as "no priority" (same as undefined)
    const aHasPriority = aPriority !== undefined && aPriority > 0;
    const bHasPriority = bPriority !== undefined && bPriority > 0;

    // Both have priority: sort by priority value (lower = higher priority)
    if (aHasPriority && bHasPriority) {
      return aPriority - bPriority;
    }

    // Items with priority come before items without priority
    if (aHasPriority && !bHasPriority) return -1;
    if (!aHasPriority && bHasPriority) return 1;

    // Both no priority: maintain original order
    return 0;
  });

  const context: TemplateContext = {
    generatedAt: new Date(),
    linearTickets,
    githubIssues,
    githubPulls,
    mergedItems,
    options,
  };

  const output = renderTemplate(template, context);

  if (options.dryRun) {
    process.stdout.write(`${output}\n`);
    return;
  }

  const outputPath = path.resolve(process.cwd(), options.outputFile);
  await writeFile(outputPath, output, 'utf8');
  process.stdout.write(`Roadmap written to ${outputPath}\n`);
}

export async function main(argv: string[] = process.argv): Promise<void> {
  const program = new Command();
  program
    .name('linear-roadmap-sync')
    .description('Generate a roadmap markdown file from Linear issues and GitHub artifacts.')
    .requiredOption('-t, --linear-team <team>', 'Linear team id, key, or name to pull issues from')
    .option('-k, --linear-api-key <key>', 'Linear API key (falls back to LINEAR_API_KEY env variable)')
    .option('-T, --linear-tag <tag>', 'Filter Linear issues by tag (can be used multiple times)', collect, [])
    .requiredOption('-r, --github-repo <repo>', 'GitHub repository in the form owner/name')
    .option('-g, --github-tag <tag>', 'Filter GitHub issues and PRs by label (can be used multiple times)', collect, [])
    .option('--github-pr-state <state>', 'Filter GitHub PRs by state: all, open, closed, merged', 'open')
    .option('-o, --output-file <file>', 'Destination markdown file', 'ROADMAP.md')
    .option('-p, --template-file <file>', 'Optional template file to override the built-in roadmap template')
    .option('--create-github-issues', 'Create GitHub issues for Linear tickets without linked issues', false)
    .option('--dry-run', 'Print the generated roadmap instead of writing to disk', false)
    .showHelpAfterError();

  program.parse(argv);
  const opts = program.opts();

  const apiKey = (opts.linearApiKey as string | undefined) ?? process.env.LINEAR_API_KEY;
  if (!apiKey) {
    throw new Error('Linear API key is required. Provide via --linear-api-key or LINEAR_API_KEY env variable.');
  }

  const prState = opts.githubPrState as string;
  if (!['all', 'open', 'closed', 'merged'].includes(prState)) {
    throw new Error(`Invalid --github-pr-state value: ${prState}. Must be one of: all, open, closed, merged`);
  }

  const syncOptions: SyncOptions = {
    linearTeam: opts.linearTeam,
    linearApiKey: apiKey,
    linearTags: opts.linearTag ?? [],
    githubRepo: opts.githubRepo,
    githubTags: opts.githubTag ?? [],
    githubPrState: prState as 'all' | 'open' | 'closed' | 'merged',
    outputFile: opts.outputFile,
    templateFile: opts.templateFile,
    dryRun: Boolean(opts.dryRun),
    createGithubIssues: Boolean(opts.createGithubIssues),
  };

  try {
    await run(syncOptions);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
