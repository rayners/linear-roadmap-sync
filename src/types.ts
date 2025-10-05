export interface LinearTicket {
  id: string;
  identifier: string;
  title: string;
  url?: string;
  state?: string;
  workflowState?: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled' | 'triage';
  priority?: number;
  tags?: string[];
  attachments?: Array<{
    url: string;
    title?: string;
    subtitle?: string;
  }>;
}

export interface GitHubIssueSummary {
  id: number;
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed';
  labels: string[];
}

export interface GitHubPullRequestSummary extends GitHubIssueSummary {
  draft?: boolean;
  merged?: boolean;
}

export interface RoadmapSection {
  title: string;
  items: string[];
}

export type MergedRoadmapItem =
  | { linearTicket: LinearTicket; githubIssue: GitHubIssueSummary; title: string }
  | { linearTicket: LinearTicket; githubIssue?: never; title: string }
  | { linearTicket?: never; githubIssue: GitHubIssueSummary; title: string };

export interface RoadmapData {
  linearTickets: LinearTicket[];
  githubIssues: GitHubIssueSummary[];
  githubPulls: GitHubPullRequestSummary[];
  mergedItems: MergedRoadmapItem[];
}

export interface TemplateContext extends RoadmapData {
  generatedAt: Date;
  options: SyncOptions;
}

export interface SyncOptions {
  linearTeam: string;
  linearApiKey: string;
  linearTags: string[];
  githubRepo: string;
  githubTags: string[];
  githubPrState: 'all' | 'open' | 'closed' | 'merged';
  outputFile: string;
  templateFile?: string;
  dryRun: boolean;
  createGithubIssues: boolean;
}
