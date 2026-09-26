/** The message of a failed query/mutation, for a `danger` Message. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
