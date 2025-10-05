import Handlebars from 'handlebars';
import { readFile } from 'node:fs/promises';
import { TemplateContext } from './types';

const DEFAULT_TEMPLATE = `# Product Roadmap

Generated at: {{generatedAt}}

## Issues
{{#each mergedItems}}- {{#if linearTicket}}[{{linearTicket.identifier}}]({{linearTicket.url}}){{/if}}{{#if githubIssue}}{{#if linearTicket}} / {{/if}}[#{{githubIssue.number}}]({{githubIssue.url}}){{/if}}: {{title}}
{{/each}}

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
