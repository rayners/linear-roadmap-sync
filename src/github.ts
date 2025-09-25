import { Octokit } from '@octokit/rest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { GitHubIssueSummary, GitHubPullRequestSummary } from './types';

const execFileAsync = promisify(execFile);

async function getGhAuthToken(): Promise<string> {
  try {
    const { stdout } = await execFileAsync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      maxBuffer: 1 * 1024 * 1024,
    });
    const token = stdout.trim();
    if (!token) {
      throw new Error('GitHub authentication token is empty. Run `gh auth login` to configure credentials.');
    }
    return token;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to retrieve GitHub auth token via gh: ${message}`);
  }
}

let octokitInstance: Promise<Octokit> | undefined;

async function getOctokit(): Promise<Octokit> {
  if (!octokitInstance) {
    octokitInstance = (async () => {
      const token = await getGhAuthToken();
      return new Octokit({ auth: token });
    })().catch((error) => {
      octokitInstance = undefined;
      throw error;
    });
  }

  return octokitInstance;
}

function parseRepo(repo: string): { owner: string; repo: string } {
  const [owner, name, ...rest] = repo.split('/').map((part) => part.trim()).filter(Boolean);
  if (!owner || !name || rest.length > 0) {
    throw new Error(`GitHub repository must be provided as "owner/name", received "${repo}"`);
  }
  return { owner, repo: name };
}

function normalizeLabels(labels: string[]): string[] {
  return labels
    .map((label) => label.trim().toLowerCase())
    .filter((label) => label.length > 0);
}

function extractLabelNames(rawLabels: Array<{ name?: string } | string> | undefined): string[] {
  if (!rawLabels) return [];
  return rawLabels
    .map((label) => (typeof label === 'string' ? label : label.name ?? ''))
    .map((name) => name.trim())
    .filter((name): name is string => name.length > 0);
}

function matchesAllLabels(issueLabels: string[], requiredLabels: string[]): boolean {
  if (requiredLabels.length === 0) return true;
  const normalizedIssueLabels = normalizeLabels(issueLabels);
  return requiredLabels.every((label) => normalizedIssueLabels.includes(label));
}

export async function fetchGitHubIssues(repo: string, labels: string[]): Promise<GitHubIssueSummary[]> {
  const { owner, repo: repoName } = parseRepo(repo);
  const octokit = await getOctokit();
  const normalizedLabels = normalizeLabels(labels);

  const issues = await octokit.paginate(octokit.issues.listForRepo, {
    owner,
    repo: repoName,
    state: 'all',
    per_page: 100,
    labels: labels.length > 0 ? labels.join(',') : undefined,
  });

  return issues
    .filter((issue) => !('pull_request' in issue))
    .map((issue) => {
      const issueLabels = extractLabelNames(issue.labels as Array<{ name?: string } | string> | undefined);
      return {
        issue,
        issueLabels,
      };
    })
    .filter(({ issueLabels }) => matchesAllLabels(issueLabels, normalizedLabels))
    .map(({ issue, issueLabels }) => ({
      id: issue.id,
      number: issue.number,
      title: issue.title ?? '',
      url: issue.html_url ?? '',
      state: issue.state as GitHubIssueSummary['state'],
      labels: issueLabels,
    }));
}

export async function fetchGitHubPullRequests(repo: string, labels: string[]): Promise<GitHubPullRequestSummary[]> {
  const { owner, repo: repoName } = parseRepo(repo);
  const octokit = await getOctokit();
  const normalizedLabels = normalizeLabels(labels);

  const pulls = await octokit.paginate(octokit.pulls.list, {
    owner,
    repo: repoName,
    state: 'all',
    per_page: 100,
  });

  return pulls
    .map((pull) => {
      const pullLabels = extractLabelNames(pull.labels as Array<{ name?: string } | string> | undefined);
      return {
        pull,
        pullLabels,
      };
    })
    .filter(({ pullLabels }) => matchesAllLabels(pullLabels, normalizedLabels))
    .map(({ pull, pullLabels }) => ({
      id: pull.id,
      number: pull.number,
      title: pull.title ?? '',
      url: pull.html_url ?? '',
      state: pull.state as GitHubPullRequestSummary['state'],
      labels: pullLabels,
      draft: Boolean(pull.draft),
      merged: Boolean(pull.merged_at),
    }));
}
