import { AuthError, ConnectionError, ExecError } from '@gepard/common';

// Over https git relays curl's messages after "unable to access '<url>':";
// over ssh it relays OpenSSH's "ssh: ..." lines.
const CONNECTION_PATTERNS: RegExp[] = [
  /could ?n.t resolve (host|hostname|proxy)/i,
  /temporary failure in name resolution/i,
  /nodename nor servname provided/i,
  /failed to connect to/i,
  /could ?n.t connect to server/i,
  /unable to connect to/i,
  /connection (refused|reset|timed out)/i,
  /timeout was reached/i,
  /operation timed out/i,
  /network is unreachable/i,
  /no route to host/i,
  /recv failure/i,
  /empty reply from server/i,
  /gnutls recv error/i,
  /ssl_error_syscall/i,
];

// `GIT_TERMINAL_PROMPT=0` turns a missing credential into "could not read Username".
const AUTH_PATTERNS: RegExp[] = [
  /authentication failed/i,
  /could not read (username|password)/i,
  /permission denied \(publickey/i,
  /invalid username or password/i,
  /requested URL returned error: 40[13]\b/,
];

function matches(patterns: RegExp[], text: string): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function classifyRemoteFailure(error: unknown): unknown {
  if (!(error instanceof ExecError)) return error;
  const { stderr, message, details } = error;
  if (matches(CONNECTION_PATTERNS, stderr)) return new ConnectionError(message, details);
  if (matches(AUTH_PATTERNS, stderr)) return new AuthError(message, details);
  return error;
}
