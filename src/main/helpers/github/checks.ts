import { z } from 'zod';
import { AnnotationLevel, GqlError, type CommitAnnotation } from '@gepard/common';

export const COMMIT_ANNOTATIONS_QUERY = `
query($owner:String!, $name:String!, $sha:GitObjectID!) {
  repository(owner:$owner, name:$name) {
    object(oid:$sha) {
      ... on Commit {
        checkSuites(first:50) {
          nodes {
            checkRuns(first:50, filterBy:{checkType:LATEST}) {
              nodes {
                name
                databaseId
                detailsUrl
                permalink
                annotations(first:50) {
                  nodes { path message title annotationLevel location { start { line } } }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

const RawAnnotation = z.object({
  path: z.string(),
  message: z.string(),
  title: z.string().nullable(),
  annotationLevel: z
    .enum(['FAILURE', 'WARNING', 'NOTICE'])
    .transform((l) => AnnotationLevel.parse(l.toLowerCase()))
    .nullable(),
  location: z.object({ start: z.object({ line: z.int().positive() }) }),
});

export const CommitAnnotationsResponse = z.object({
  data: z.object({
    repository: z
      .object({
        object: z
          .object({
            checkSuites: z
              .object({
                nodes: z.array(
                  z
                    .object({
                      checkRuns: z.object({
                        nodes: z.array(
                          z
                            .object({
                              name: z.string(),
                              databaseId: z.int().nullable(),
                              detailsUrl: z.string().nullable(),
                              permalink: z.string(),
                              annotations: z.object({ nodes: z.array(RawAnnotation) }).nullable(),
                            })
                            .nullable(),
                        ),
                      }),
                    })
                    .nullable(),
                ),
              })
              .optional(),
          })
          .nullable(),
      })
      .nullable(),
  }),
  errors: z.array(GqlError).optional(),
});
export type CommitAnnotationsResponse = z.infer<typeof CommitAnnotationsResponse>;

export function parseCommitAnnotations(res: CommitAnnotationsResponse): CommitAnnotation[] {
  const suites = res.data.repository?.object?.checkSuites?.nodes ?? [];
  return suites.flatMap((suite) =>
    (suite?.checkRuns.nodes ?? []).flatMap((run) =>
      run === null
        ? []
        : (run.annotations?.nodes ?? []).flatMap((a) =>
            a.annotationLevel === null
              ? []
              : [
                  {
                    path: a.path,
                    annotation: {
                      checkName: run.name,
                      level: a.annotationLevel,
                      line: a.location.start.line,
                      title: a.title ?? '',
                      message: a.message,
                      runId: run.databaseId ?? 0,
                      url: run.detailsUrl ?? run.permalink,
                    },
                  },
                ],
          ),
    ),
  );
}
