import {
  AuthError,
  ConnectionError,
  ExecError,
  RateLimitError,
  RemoteNotFoundError,
} from '@gepard/common';

// gh prints its own "error connecting to <host>" for dial failures and Go's
// net errors (`dial tcp ...`, `net/http: ...`) for everything else.
const CONNECTION_PATTERNS: RegExp[] = [
  /error connecting to /i,
  /check your internet connection/i,
  /dial tcp/i,
  /no such host/i,
  /temporary failure in name resolution/i,
  /i\/o timeout/i,
  /TLS handshake timeout/i,
  /context deadline exceeded/i,
  /connection (refused|reset)/i,
  /network is unreachable/i,
  /no route to host/i,
];

const AUTH_PATTERNS: RegExp[] = [
  /gh auth login/i,
  /not logged in/i,
  /HTTP 401/,
  /bad credentials/i,
  /requires authentication/i,
  /authentication (required|failed)/i,
];

const RATE_LIMIT_PATTERNS: RegExp[] = [/rate limit/i, /HTTP 429/, /\(RATE_LIMITED\)/];

// REST failures end in "(HTTP 404)"; GraphQL partial errors in "(NOT_FOUND)".
const NOT_FOUND_PATTERNS: RegExp[] = [/HTTP 404/, /\(NOT_FOUND\)/];

function matches(patterns: RegExp[], text: string): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function classifyFailure(error: unknown): unknown {
  if (!(error instanceof ExecError)) return error;
  const { stderr, message, details } = error;
  if (matches(CONNECTION_PATTERNS, stderr)) return new ConnectionError(message, details);
  if (matches(AUTH_PATTERNS, stderr)) return new AuthError(message, details);
  if (matches(RATE_LIMIT_PATTERNS, stderr)) return new RateLimitError(message, details);
  if (matches(NOT_FOUND_PATTERNS, stderr)) return new RemoteNotFoundError(message, details);
  return error;
}
