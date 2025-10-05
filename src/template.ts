import Handlebars from 'handlebars';
import { readFile } from 'node:fs/promises';
import { TemplateContext } from './types';

const DEFAULT_TEMPLATE = `# Product Roadmap

Generated at: {{generatedAt}}

## Issues

### Started
{{#each mergedItems}}{{#if linearTicket}}{{#if (eq linearTicket.workflowState "started")}}- [{{linearTicket.identifier}}]({{linearTicket.url}}){{#if githubIssue}} / [#{{githubIssue.number}}]({{githubIssue.url}}){{/if}}: {{title}} ({{linearTicket.state}})
{{/if}}{{/if}}{{/each}}
### Unstarted
{{#each mergedItems}}{{#if linearTicket}}{{#if (eq linearTicket.workflowState "unstarted")}}- [{{linearTicket.identifier}}]({{linearTicket.url}}){{#if githubIssue}} / [#{{githubIssue.number}}]({{githubIssue.url}}){{/if}}: {{title}} ({{linearTicket.state}})
{{/if}}{{/if}}{{/each}}
### Backlog
{{#each mergedItems}}{{#if linearTicket}}{{#if (eq linearTicket.workflowState "backlog")}}- [{{linearTicket.identifier}}]({{linearTicket.url}}){{#if githubIssue}} / [#{{githubIssue.number}}]({{githubIssue.url}}){{/if}}: {{title}} ({{linearTicket.state}})
{{/if}}{{/if}}{{/each}}
### GitHub Only
{{#each mergedItems}}{{#if githubIssue}}{{#unless linearTicket}}- [#{{githubIssue.number}}]({{githubIssue.url}}): {{title}}
{{/unless}}{{/if}}{{/each}}
## GitHub Pull Requests
{{#each githubPulls}}- [#{{number}}]({{url}}): {{title}}
{{/each}}
`;

export async function loadTemplate(templateFile?: string): Promise<string> {
  if (!templateFile) {
    return DEFAULT_TEMPLATE;
  }

  try {
    const contents = await readFile(templateFile, 'utf8');
    return contents;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load template from "${templateFile}": ${message}`);
  }
}

// Register Handlebars helpers
Handlebars.registerHelper('eq', function (a, b) {
  return a === b;
});

export function renderTemplate(template: string, context: TemplateContext): string {
  const compiled = Handlebars.compile(template, {
    strict: true,
    noEscape: false,
    assumeObjects: true,
  });
  return compiled({
    ...context,
    generatedAt: context.generatedAt.toISOString(),
  });
}
