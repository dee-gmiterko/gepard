import { z } from 'zod';
import { AppError } from '../../ipc/registry';
import { GqlPageInfo, type GqlError, type PrListItem, matchesTarget } from '@gepard/common';
import { ExecError } from '../process/ExecError';

const PR_LIST_FIELDS =
  'number,id,title,author,headRefName,baseRefName,headRefOid,createdAt,changedFiles,labels,url';

// `gh pr list --limit N` fetches 100 PRs per request and stops at the first
// short page.
const OPEN_PR_LIST_LIMIT = 10_000;

export function buildPrListArgs(owner: string, repo: string, search?: string): string[] {
  const args = [
    'pr',
    'list',
    '-R',
    `${owner}/${repo}`,
    '--limit',
    String(OPEN_PR_LIST_LIMIT),
    '--json',
    PR_LIST_FIELDS,
  ];
  if (search) args.push('--search', search);
  return args;
}

// `gh pr create` has no `--json` and prints the new PR's URL as the last line
// of stdout.
export function parsePrCreateUrl(stdout: string): number {
  const match = stdout.trim().match(/\/pull\/(\d+)\s*$/);
  if (!match)
    throw new AppError('GH_PARSE_ERROR', `gh pr create did not return a PR URL: ${stdout.trim()}`);
  return Number(match[1]);
}

export const PrFilesNode = z.object({
  number: z.int().positive(),
  files: z.object({
    pageInfo: GqlPageInfo,
    nodes: z.array(z.object({ path: z.string() })),
  }),
});

export function buildPrsFilesQuery(numbers: number[]): {
  query: string;
  variables: Record<string, unknown>;
} {
  const varDecls = ['$owner:String!', '$name:String!'];
  const fields: string[] = [];
  const variables: Record<string, unknown> = {};
  numbers.forEach((n, i) => {
    const v = `n${i}`;
    varDecls.push(`$${v}:Int!`);
    variables[v] = n;
    fields.push(
      `pr${i}: pullRequest(number:$${v}) { number files(first:100) { pageInfo { hasNextPage endCursor } nodes { path } } }`,
    );
  });
  const query = `query(${varDecls.join(', ')}) {\n  repository(owner:$owner, name:$name) {\n${fields.join('\n')}\n  }\n}`;
  return { query, variables };
}

// GitHub returns a null node for a PR number that is deleted or inaccessible.
export function parsePrsFilesResponse(
  repository: Record<string, z.infer<typeof PrFilesNode> | null>,
): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const node of Object.values(repository)) {
    if (node)
      map.set(
        node.number,
        node.files.nodes.map((f) => f.path),
      );
  }
  return map;
}

export function parsePrsFilesPageInfo(
  repository: Record<string, z.infer<typeof PrFilesNode> | null>,
): Map<number, string> {
  const map = new Map<number, string>();
  for (const node of Object.values(repository)) {
    if (node?.files.pageInfo.hasNextPage && node.files.pageInfo.endCursor) {
      map.set(node.number, node.files.pageInfo.endCursor);
    }
  }
  return map;
}

export function filterPrsByPath(
  prs: PrListItem[],
  filesByNumber: Map<number, string[]>,
  path: string,
): PrListItem[] {
  return prs.filter((pr) =>
    (filesByNumber.get(pr.number) ?? []).some((f) => matchesTarget(f, path)),
  );
}

// Same corpus the fuzzy-search combo box matches against, since `gh pr list
// --search` has no REST equivalent for single PRs fetched by number.
export function matchesPrSearch(pr: PrListItem, search: string): boolean {
  const q = search.toLowerCase();
  return (
    String(pr.number).includes(q) ||
    pr.title.toLowerCase().includes(q) ||
    pr.author.login.toLowerCase().includes(q) ||
    pr.headRefName.toLowerCase().includes(q) ||
    pr.labels.some((l) => l.name.toLowerCase().includes(q))
  );
}

// A single aliased GraphQL query aliasing every candidate PR would exceed
// GitHub's query cost limit once a repo has thousands of open PRs.
export const PRS_FILES_CHUNK_SIZE = 50;

export function isLineNotInDiffError(e: unknown): boolean {
  return e instanceof ExecError && /must be part of the diff/i.test(e.stderr);
}

export function checkGqlErrors(errors: GqlError[] | undefined): void {
  if (errors && errors.length > 0) {
    throw new AppError('GRAPHQL_ERROR', errors.map((e) => e.message).join('; '), errors);
  }
}
