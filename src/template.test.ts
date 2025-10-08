import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderTemplate, loadTemplate } from './template';
import { TemplateContext } from './types';
import { readFile } from 'node:fs/promises';

vi.mock('node:fs/promises');

describe('template', () => {
  describe('renderTemplate', () => {
    let mockContext: TemplateContext;

    beforeEach(() => {
      mockContext = {
        generatedAt: new Date('2025-01-01T00:00:00.000Z'),
        linearTickets: [],
        githubIssues: [],
        githubPulls: [],
        mergedItems: [],
        options: {
          linearTeam: 'TEST',
          linearApiKey: 'test-key',
          linearTags: [],
          githubRepo: 'owner/repo',
          githubTags: [],
          githubPrState: 'open',
          outputFile: 'ROADMAP.md',
          dryRun: false,
          createGithubIssues: false,
        },
      };
    });

    it('should render empty template with no items', () => {
      const template = `# Test\n{{#each mergedItems}}Item{{/each}}`;
      const result = renderTemplate(template, mockContext);
      expect(result).toBe('# Test\n');
    });

    it('should render generatedAt as ISO string', () => {
      const template = `{{generatedAt}}`;
      const result = renderTemplate(template, mockContext);
      expect(result).toBe('2025-01-01T00:00:00.000Z');
    });

    it('should render Linear tickets', () => {
      mockContext.mergedItems = [
        {
          linearTicket: {
            id: '1',
            identifier: 'TEST-1',
            title: 'Test Issue',
            url: 'https://linear.app/test/1',
            state: 'Todo',
            workflowState: 'unstarted',
            priority: 1,
          },
          title: 'Test Issue',
        },
      ];

      const template = `{{#each mergedItems}}{{linearTicket.identifier}}: {{title}}\n{{/each}}`;
      const result = renderTemplate(template, mockContext);
      expect(result).toBe('TEST-1: Test Issue\n');
    });

    it('should render linked Linear ticket and GitHub issue', () => {
      mockContext.mergedItems = [
        {
          linearTicket: {
            id: '1',
            identifier: 'TEST-1',
            title: 'Test Issue',
            url: 'https://linear.app/test/1',
          },
          githubIssue: {
            id: 100,
            number: 10,
            title: 'Test Issue',
            url: 'https://github.com/owner/repo/issues/10',
            state: 'open',
            labels: [],
          },
          title: 'Test Issue',
        },
      ];

      const template = `{{#each mergedItems}}{{linearTicket.identifier}} / #{{githubIssue.number}}\n{{/each}}`;
      const result = renderTemplate(template, mockContext);
      expect(result).toBe('TEST-1 / #10\n');
    });

    it('should render GitHub-only issues', () => {
      mockContext.mergedItems = [
        {
          githubIssue: {
            id: 100,
            number: 10,
            title: 'GitHub Only',
            url: 'https://github.com/owner/repo/issues/10',
            state: 'open',
            labels: [],
          },
          title: 'GitHub Only',
        },
      ];

      const template = `{{#each mergedItems}}#{{githubIssue.number}}: {{title}}\n{{/each}}`;
      const result = renderTemplate(template, mockContext);
      expect(result).toBe('#10: GitHub Only\n');
    });

    it('should render GitHub pull requests', () => {
      mockContext.githubPulls = [
        {
          id: 200,
          number: 20,
          title: 'Test PR',
          url: 'https://github.com/owner/repo/pull/20',
          state: 'open',
          labels: [],
          merged: false,
        },
      ];

      const template = `{{#each githubPulls}}#{{number}}: {{title}}\n{{/each}}`;
      const result = renderTemplate(template, mockContext);
      expect(result).toBe('#20: Test PR\n');
    });

    it('should use eq helper for conditional rendering', () => {
      mockContext.mergedItems = [
        {
          linearTicket: {
            id: '1',
            identifier: 'TEST-1',
            title: 'Started',
            workflowState: 'started',
          },
          title: 'Started',
        },
        {
          linearTicket: {
            id: '2',
            identifier: 'TEST-2',
            title: 'Unstarted',
            workflowState: 'unstarted',
          },
          title: 'Unstarted',
        },
      ];

      const template = `{{#each mergedItems}}{{#if linearTicket}}{{#if (eq linearTicket.workflowState "started")}}{{linearTicket.identifier}}\n{{/if}}{{/if}}{{/each}}`;
      const result = renderTemplate(template, mockContext);
      expect(result).toBe('TEST-1\n');
    });

    it('should handle priority values', () => {
      mockContext.mergedItems = [
        {
          linearTicket: {
            id: '1',
            identifier: 'TEST-1',
            title: 'Urgent',
            priority: 1,
          },
          title: 'Urgent',
        },
        {
          linearTicket: {
            id: '2',
            identifier: 'TEST-2',
            title: 'No Priority',
            priority: 0,
          },
          title: 'No Priority',
        },
      ];

      const template = `{{#each mergedItems}}{{linearTicket.identifier}}: {{linearTicket.priority}}\n{{/each}}`;
      const result = renderTemplate(template, mockContext);
      expect(result).toBe('TEST-1: 1\nTEST-2: 0\n');
    });
  });

  describe('loadTemplate', () => {
    it('should return default template when no file specified', async () => {
      const template = await loadTemplate();
      expect(template).toContain('# Product Roadmap');
      expect(template).toContain('### Started');
      expect(template).toContain('### Unstarted');
      expect(template).toContain('### Backlog');
    });

    it('should load custom template from file', async () => {
      const mockFileContent = '# Custom Template\n{{generatedAt}}';
      vi.mocked(readFile).mockResolvedValue(mockFileContent);

      const template = await loadTemplate('custom.hbs');
      expect(template).toBe(mockFileContent);
      expect(readFile).toHaveBeenCalledWith('custom.hbs', 'utf8');
    });

    it('should throw error when file loading fails', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'));

      await expect(loadTemplate('missing.hbs')).rejects.toThrow(
        'Failed to load template from "missing.hbs": File not found'
      );
    });

    it('should handle non-Error rejections', async () => {
      vi.mocked(readFile).mockRejectedValue('Unknown error');

      await expect(loadTemplate('error.hbs')).rejects.toThrow(
        'Failed to load template from "error.hbs": Unknown error'
      );
    });
  });
});
