import { readFile } from 'node:fs/promises';
import { TemplateContext } from './types';

const DEFAULT_TEMPLATE = `# Product Roadmap\n\nGenerated at: {{generatedAt}}\n\n## Linear Tickets\n{{#each linearTickets}}- [{{identifier}}]({{url}}): {{title}}\n{{/each}}\n\n## GitHub Issues\n{{#each githubIssues}}- [#{{number}}]({{url}}): {{title}}\n{{/each}}\n\n## GitHub Pull Requests\n{{#each githubPulls}}- [#{{number}}]({{url}}): {{title}}\n{{/each}}\n`;

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
  // Simple mustache-style replacement to keep the skeleton lightweight.
  // For real-world use consider integrating a templating engine.
  let output = template.replace('{{generatedAt}}', context.generatedAt.toISOString());

  output = output.replace(/{{#each linearTickets}}([\s\S]*?){{\/each}}/g, (_, block: string) =>
    context.linearTickets
      .map((ticket) => {
        // If URL is missing, render identifier without link
        const urlReplacement = ticket.url
          ? ticket.url
          : `https://linear.app/issue/${ticket.identifier}`; // Use Linear's URL pattern as fallback
        return block
          .replaceAll('{{identifier}}', ticket.identifier)
          .replaceAll('{{url}}', urlReplacement)
          .replaceAll('{{title}}', ticket.title);
      })
      .join('')
  );

  output = output.replace(/{{#each githubIssues}}([\s\S]*?){{\/each}}/g, (_, block: string) =>
    context.githubIssues
      .map((issue) =>
        block
          .replaceAll('{{number}}', issue.number.toString())
          .replaceAll('{{url}}', issue.url)
          .replaceAll('{{title}}', issue.title)
      )
      .join('')
  );

  output = output.replace(/{{#each githubPulls}}([\s\S]*?){{\/each}}/g, (_, block: string) =>
    context.githubPulls
      .map((pull) =>
        block
          .replaceAll('{{number}}', pull.number.toString())
          .replaceAll('{{url}}', pull.url)
          .replaceAll('{{title}}', pull.title)
      )
      .join('')
  );

  return output;
}
