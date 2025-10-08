import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { main } from './index';
import * as github from './github';
import * as linear from './linear';
import * as template from './template';
import { writeFile } from 'node:fs/promises';
import process from 'node:process';

vi.mock('./github');
vi.mock('./linear');
vi.mock('./template');
vi.mock('node:fs/promises');

describe('index', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    vi.mocked(template.loadTemplate).mockResolvedValue('# Template\n{{#each mergedItems}}{{/each}}');
    vi.mocked(template.renderTemplate).mockReturnValue('# Rendered Output\n');
    vi.mocked(github.fetchGitHubIssues).mockResolvedValue([]);
    vi.mocked(github.fetchGitHubPullRequests).mockResolvedValue([]);
    vi.mocked(linear.fetchLinearTickets).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CLI argument parsing', () => {
    it('should require linear-team argument', async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
      await main(['node', 'cli', '--github-repo', 'owner/repo', '--linear-api-key', 'key']);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("required option '-t, --linear-team <team>' not specified"));
      exitSpy.mockRestore();
    });

    it('should require github-repo argument', async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
      await main(['node', 'cli', '--linear-team', 'TEST', '--linear-api-key', 'key']);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("required option '-r, --github-repo <repo>' not specified"));
      exitSpy.mockRestore();
    });

    it('should use LINEAR_API_KEY env var when flag not provided', async () => {
      process.env.LINEAR_API_KEY = 'env-key';
      await main(['node', 'cli', '--linear-team', 'TEST', '--github-repo', 'owner/repo', '--dry-run']);

      expect(linear.fetchLinearTickets).toHaveBeenCalledWith('TEST', [], 'env-key');
      delete process.env.LINEAR_API_KEY;
    });

    it('should throw error when LINEAR_API_KEY not provided', async () => {
      delete process.env.LINEAR_API_KEY;

      await expect(
        main(['node', 'cli', '--linear-team', 'TEST', '--github-repo', 'owner/repo'])
      ).rejects.toThrow('Linear API key is required');
    });

    it('should throw error for invalid github-pr-state values', async () => {
      await expect(
        main(['node', 'cli', '--linear-team', 'TEST', '--github-repo', 'owner/repo', '--linear-api-key', 'key', '--github-pr-state', 'invalid'])
      ).rejects.toThrow('Invalid --github-pr-state value');
    });
  });

  describe('workflow state filtering', () => {
    it('should filter out completed tickets', async () => {
      vi.mocked(linear.fetchLinearTickets).mockResolvedValue([
        {
          id: '1',
          identifier: 'TEST-1',
          title: 'Completed',
          workflowState: 'completed',
        },
        {
          id: '2',
          identifier: 'TEST-2',
          title: 'Active',
          workflowState: 'started',
        },
      ]);

      await main(['node', 'cli', '--linear-team', 'TEST', '--github-repo', 'owner/repo', '--linear-api-key', 'key', '--dry-run']);

      const renderCall = vi.mocked(template.renderTemplate).mock.calls[0];
      const context = renderCall[1];

      expect(context.mergedItems).toHaveLength(1);
      expect(context.mergedItems[0].linearTicket?.identifier).toBe('TEST-2');
    });

    it('should filter out canceled tickets', async () => {
      vi.mocked(linear.fetchLinearTickets).mockResolvedValue([
        {
          id: '1',
          identifier: 'TEST-1',
          title: 'Canceled',
          workflowState: 'canceled',
        },
        {
          id: '2',
          identifier: 'TEST-2',
          title: 'Active',
          workflowState: 'unstarted',
        },
      ]);

      await main(['node', 'cli', '--linear-team', 'TEST', '--github-repo', 'owner/repo', '--linear-api-key', 'key', '--dry-run']);

      const renderCall = vi.mocked(template.renderTemplate).mock.calls[0];
      const context = renderCall[1];

      expect(context.mergedItems).toHaveLength(1);
      expect(context.mergedItems[0].linearTicket?.identifier).toBe('TEST-2');
    });

    it('should keep tickets without workflowState', async () => {
      vi.mocked(linear.fetchLinearTickets).mockResolvedValue([
        {
          id: '1',
          identifier: 'TEST-1',
          title: 'No State',
        },
      ]);

      await main(['node', 'cli', '--linear-team', 'TEST', '--github-repo', 'owner/repo', '--linear-api-key', 'key', '--dry-run']);

      const renderCall = vi.mocked(template.renderTemplate).mock.calls[0];
      const context = renderCall[1];

      expect(context.mergedItems).toHaveLength(1);
    });
  });

  describe('priority sorting', () => {
    it('should sort by priority (lower value = higher priority)', async () => {
      vi.mocked(linear.fetchLinearTickets).mockResolvedValue([
        {
          id: '1',
          identifier: 'TEST-1',
          title: 'Low',
          priority: 4,
        },
        {
          id: '2',
          identifier: 'TEST-2',
          title: 'Urgent',
          priority: 1,
        },
        {
          id: '3',
          identifier: 'TEST-3',
          title: 'High',
          priority: 2,
        },
      ]);

      await main(['node', 'cli', '--linear-team', 'TEST', '--github-repo', 'owner/repo', '--linear-api-key', 'key', '--dry-run']);

      const renderCall = vi.mocked(template.renderTemplate).mock.calls[0];
      const context = renderCall[1];

      expect(context.mergedItems[0].linearTicket?.identifier).toBe('TEST-2'); // priority 1
      expect(context.mergedItems[1].linearTicket?.identifier).toBe('TEST-3'); // priority 2
      expect(context.mergedItems[2].linearTicket?.identifier).toBe('TEST-1'); // priority 4
    });

    it('should place items with priority before items without priority', async () => {
      vi.mocked(linear.fetchLinearTickets).mockResolvedValue([
        {
          id: '1',
          identifier: 'TEST-1',
          title: 'No Priority',
        },
        {
          id: '2',
          identifier: 'TEST-2',
          title: 'Has Priority',
          priority: 3,
        },
      ]);

      await main(['node', 'cli', '--linear-team', 'TEST', '--github-repo', 'owner/repo', '--linear-api-key', 'key', '--dry-run']);

      const renderCall = vi.mocked(template.renderTemplate).mock.calls[0];
      const context = renderCall[1];

      expect(context.mergedItems[0].linearTicket?.identifier).toBe('TEST-2');
      expect(context.mergedItems[1].linearTicket?.identifier).toBe('TEST-1');
    });

    it('should treat priority=0 as no priority', async () => {
      vi.mocked(linear.fetchLinearTickets).mockResolvedValue([
        {
          id: '1',
          identifier: 'TEST-1',
          title: 'Priority 0',
          priority: 0,
        },
        {
          id: '2',
          identifier: 'TEST-2',
          title: 'Priority 4',
          priority: 4,
        },
      ]);

      await main(['node', 'cli', '--linear-team', 'TEST', '--github-repo', 'owner/repo', '--linear-api-key', 'key', '--dry-run']);

      const renderCall = vi.mocked(template.renderTemplate).mock.calls[0];
      const context = renderCall[1];

      expect(context.mergedItems[0].linearTicket?.identifier).toBe('TEST-2'); // priority 4 comes before 0
      expect(context.mergedItems[1].linearTicket?.identifier).toBe('TEST-1');
    });
  });

  describe('PR state filtering', () => {
    beforeEach(() => {
      vi.mocked(github.fetchGitHubPullRequests).mockResolvedValue([
        {
          id: 1,
          number: 1,
          title: 'Open PR',
          url: 'https://github.com/owner/repo/pull/1',
          state: 'open',
          labels: [],
          merged: false,
        },
        {
          id: 2,
          number: 2,
          title: 'Merged PR',
          url: 'https://github.com/owner/repo/pull/2',
          state: 'closed',
          labels: [],
          merged: true,
        },
        {
          id: 3,
          number: 3,
          title: 'Closed PR',
          url: 'https://github.com/owner/repo/pull/3',
          state: 'closed',
          labels: [],
          merged: false,
        },
      ]);
    });

    it('should filter open PRs by default', async () => {
      await main(['node', 'cli', '--linear-team', 'TEST', '--github-repo', 'owner/repo', '--linear-api-key', 'key', '--dry-run']);

      const renderCall = vi.mocked(template.renderTemplate).mock.calls[0];
      const context = renderCall[1];

      expect(context.githubPulls).toHaveLength(1);
      expect(context.githubPulls[0].number).toBe(1);
    });

    it('should filter merged PRs when state=merged', async () => {
      await main(['node', 'cli', '--linear-team', 'TEST', '--github-repo', 'owner/repo', '--linear-api-key', 'key', '--github-pr-state', 'merged', '--dry-run']);

      const renderCall = vi.mocked(template.renderTemplate).mock.calls[0];
      const context = renderCall[1];

      expect(context.githubPulls).toHaveLength(1);
      expect(context.githubPulls[0].number).toBe(2);
    });

    it('should filter closed non-merged PRs when state=closed', async () => {
      await main(['node', 'cli', '--linear-team', 'TEST', '--github-repo', 'owner/repo', '--linear-api-key', 'key', '--github-pr-state', 'closed', '--dry-run']);

      const renderCall = vi.mocked(template.renderTemplate).mock.calls[0];
      const context = renderCall[1];

      expect(context.githubPulls).toHaveLength(1);
      expect(context.githubPulls[0].number).toBe(3);
    });

    it('should include all PRs when state=all', async () => {
      await main(['node', 'cli', '--linear-team', 'TEST', '--github-repo', 'owner/repo', '--linear-api-key', 'key', '--github-pr-state', 'all', '--dry-run']);

      const renderCall = vi.mocked(template.renderTemplate).mock.calls[0];
      const context = renderCall[1];

      expect(context.githubPulls).toHaveLength(3);
    });
  });

  describe('issue linking', () => {
    it('should link Linear tickets with GitHub issues', async () => {
      vi.mocked(linear.fetchLinearTickets).mockResolvedValue([
        {
          id: '1',
          identifier: 'TEST-1',
          title: 'Linked Issue',
          attachments: [
            { url: 'https://github.com/owner/repo/issues/10' },
          ],
        },
      ]);

      vi.mocked(github.fetchGitHubIssues).mockResolvedValue([
        {
          id: 100,
          number: 10,
          title: 'GitHub Issue',
          url: 'https://github.com/owner/repo/issues/10',
          state: 'open',
          labels: [],
        },
      ]);

      await main(['node', 'cli', '--linear-team', 'TEST', '--github-repo', 'owner/repo', '--linear-api-key', 'key', '--dry-run']);

      const renderCall = vi.mocked(template.renderTemplate).mock.calls[0];
      const context = renderCall[1];

      expect(context.mergedItems).toHaveLength(1);
      expect(context.mergedItems[0].linearTicket?.identifier).toBe('TEST-1');
      expect(context.mergedItems[0].githubIssue?.number).toBe(10);
    });

    it('should include unlinked GitHub issues separately', async () => {
      vi.mocked(github.fetchGitHubIssues).mockResolvedValue([
        {
          id: 100,
          number: 10,
          title: 'Unlinked GitHub Issue',
          url: 'https://github.com/owner/repo/issues/10',
          state: 'open',
          labels: [],
        },
      ]);

      await main(['node', 'cli', '--linear-team', 'TEST', '--github-repo', 'owner/repo', '--linear-api-key', 'key', '--dry-run']);

      const renderCall = vi.mocked(template.renderTemplate).mock.calls[0];
      const context = renderCall[1];

      expect(context.mergedItems).toHaveLength(1);
      expect(context.mergedItems[0].githubIssue?.number).toBe(10);
      expect(context.mergedItems[0].linearTicket).toBeUndefined();
    });

    it('should not link non-GitHub URLs', async () => {
      vi.mocked(linear.fetchLinearTickets).mockResolvedValue([
        {
          id: '1',
          identifier: 'TEST-1',
          title: 'Issue with non-GitHub link',
          attachments: [
            { url: 'https://example.com/issue/1' },
          ],
        },
      ]);

      await main(['node', 'cli', '--linear-team', 'TEST', '--github-repo', 'owner/repo', '--linear-api-key', 'key', '--dry-run']);

      const renderCall = vi.mocked(template.renderTemplate).mock.calls[0];
      const context = renderCall[1];

      expect(context.mergedItems[0].githubIssue).toBeUndefined();
    });
  });

  describe('output handling', () => {
    it('should write to stdout in dry-run mode', async () => {
      vi.mocked(template.renderTemplate).mockReturnValue('# Dry Run Output\n');

      await main(['node', 'cli', '--linear-team', 'TEST', '--github-repo', 'owner/repo', '--linear-api-key', 'key', '--dry-run']);

      expect(stdoutSpy).toHaveBeenCalledWith('# Dry Run Output\n\n');
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('should write to file when not in dry-run mode', async () => {
      vi.mocked(template.renderTemplate).mockReturnValue('# File Output\n');

      await main(['node', 'cli', '--linear-team', 'TEST', '--github-repo', 'owner/repo', '--linear-api-key', 'key']);

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('ROADMAP.md'),
        '# File Output\n',
        'utf8'
      );
    });

    it('should write to custom output file', async () => {
      await main(['node', 'cli', '--linear-team', 'TEST', '--github-repo', 'owner/repo', '--linear-api-key', 'key', '--output-file', 'CUSTOM.md']);

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('CUSTOM.md'),
        expect.any(String),
        'utf8'
      );
    });
  });

  describe('GitHub issue creation', () => {
    it('should not create issues by default', async () => {
      vi.mocked(linear.fetchLinearTickets).mockResolvedValue([
        {
          id: '1',
          identifier: 'TEST-1',
          title: 'Unlinked',
        },
      ]);

      await main(['node', 'cli', '--linear-team', 'TEST', '--github-repo', 'owner/repo', '--linear-api-key', 'key', '--dry-run']);

      expect(github.createGitHubIssue).not.toHaveBeenCalled();
    });

    it('should create issues when flag is set', async () => {
      vi.mocked(linear.fetchLinearTickets).mockResolvedValue([
        {
          id: '1',
          identifier: 'TEST-1',
          title: 'Unlinked',
          url: 'https://linear.app/test/1',
          state: 'Todo',
          priority: 1,
        },
      ]);

      vi.mocked(github.createGitHubIssue).mockResolvedValue({
        id: 100,
        number: 10,
        title: 'Unlinked',
        url: 'https://github.com/owner/repo/issues/10',
        state: 'open',
        labels: [],
      });

      await main(['node', 'cli', '--linear-team', 'TEST', '--github-repo', 'owner/repo', '--linear-api-key', 'key', '--create-github-issues']);

      expect(github.createGitHubIssue).toHaveBeenCalledWith(
        'owner/repo',
        'Unlinked',
        'Linear ticket: https://linear.app/test/1\n\nState: Todo\nPriority: 1',
        []
      );
    });

    it('should skip issue creation in dry-run mode', async () => {
      vi.mocked(linear.fetchLinearTickets).mockResolvedValue([
        {
          id: '1',
          identifier: 'TEST-1',
          title: 'Unlinked',
        },
      ]);

      await main(['node', 'cli', '--linear-team', 'TEST', '--github-repo', 'owner/repo', '--linear-api-key', 'key', '--create-github-issues', '--dry-run']);

      expect(github.createGitHubIssue).not.toHaveBeenCalled();
    });

    it('should handle issue creation failures gracefully', async () => {
      vi.mocked(linear.fetchLinearTickets).mockResolvedValue([
        {
          id: '1',
          identifier: 'TEST-1',
          title: 'Will Fail',
        },
        {
          id: '2',
          identifier: 'TEST-2',
          title: 'Will Succeed',
        },
      ]);

      vi.mocked(github.createGitHubIssue)
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({
          id: 100,
          number: 10,
          title: 'Will Succeed',
          url: 'https://github.com/owner/repo/issues/10',
          state: 'open',
          labels: [],
        });

      await main(['node', 'cli', '--linear-team', 'TEST', '--github-repo', 'owner/repo', '--linear-api-key', 'key', '--create-github-issues']);

      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to create issue for TEST-1'));
      expect(github.createGitHubIssue).toHaveBeenCalledTimes(2);
    });
  });
});
