import { Issue, LinearClient } from '@linear/sdk';
import { LinearTicket } from './types';

type ConnectionLike<Node> = {
  nodes: Node[];
  pageInfo: { hasNextPage: boolean };
  fetchNext(): Promise<unknown>;
};

async function collectAllNodes<Node>(connection: ConnectionLike<Node>): Promise<Node[]> {
  const nodes: Node[] = [...connection.nodes];
  while (connection.pageInfo.hasNextPage) {
    const previousLength = connection.nodes.length;
    await connection.fetchNext();
    const newNodes = connection.nodes.slice(previousLength);
    nodes.push(...newNodes);
  }
  return nodes;
}

async function resolveLinearTeam(client: LinearClient, teamIdentifier: string) {
  const normalized = teamIdentifier.trim().toLowerCase();
  if (!normalized) {
    throw new Error('Linear team identifier must not be empty.');
  }

  const teamConnection = await client.teams({ first: 50 });
  const teams = await collectAllNodes(teamConnection);

  return (
    teams.find((team) => team.id.toLowerCase() === normalized) ??
    teams.find((team) => team.key?.toLowerCase() === normalized) ??
    teams.find((team) => team.name?.toLowerCase() === normalized)
  );
}

async function fetchIssueLabels(issue: Issue) {
  const labelsConnection = await issue.labels({ first: 50 });
  const labels = await collectAllNodes(labelsConnection);
  return labels.map((label) => label.name).filter((name): name is string => Boolean(name));
}

export async function fetchLinearTickets(teamIdentifier: string, tags: string[], apiKey: string): Promise<LinearTicket[]> {
  const client = new LinearClient({ apiKey });
  const team = await resolveLinearTeam(client, teamIdentifier);

  if (!team) {
    throw new Error(`Unable to resolve Linear team for "${teamIdentifier}"`);
  }

  const issuesConnection = await client.issues({
    filter: { team: { id: { eq: team.id } } },
    first: 50,
  });

  const issues = await collectAllNodes(issuesConnection as ConnectionLike<Issue>);
  const normalizedTags = tags.map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0);

  const tickets = await Promise.all(
    issues.map(async (issue): Promise<LinearTicket | null> => {
      const labelNames = await fetchIssueLabels(issue);
      const normalizedIssueLabels = labelNames.map((label) => label.toLowerCase());

      if (
        normalizedTags.length > 0 &&
        !normalizedTags.every((tag) => normalizedIssueLabels.includes(tag))
      ) {
        return null;
      }

      const statePromise = issue.state;
      const state = statePromise ? (await statePromise)?.name : undefined;

      const ticket: LinearTicket = {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        url: issue.url ?? undefined,
        tags: labelNames,
        ...(state ? { state } : {}),
      };

      return ticket;
    })
  );

  return tickets.filter((ticket): ticket is LinearTicket => ticket !== null);
}
