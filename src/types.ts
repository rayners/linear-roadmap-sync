export interface LinearTicket {
  id: string;
  identifier: string;
  title: string;
  url?: string;
  state?: string;
  tags?: string[];
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

export interface RoadmapData {
  linearTickets: LinearTicket[];
  githubIssues: GitHubIssueSummary[];
  githubPulls: GitHubPullRequestSummary[];
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
  outputFile: string;
  templateFile?: string;
  dryRun: boolean;
}
