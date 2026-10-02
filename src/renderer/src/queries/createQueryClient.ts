import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { reportQueryError } from '../errors/report';
import { isCancelledError } from '../ipc/client';

function mutationScope(mutation: {
  options: { mutationKey?: unknown };
  mutationId: number;
}): string {
  const key = mutation.options.mutationKey;
  return `mutation:${key ? JSON.stringify(key) : mutation.mutationId}`;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => reportQueryError(`query:${query.queryHash}`, error),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _onMutateResult, mutation) =>
        reportQueryError(mutationScope(mutation), error),
    }),
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => !isCancelledError(error) && failureCount < 3,
      },
    },
  });
}
