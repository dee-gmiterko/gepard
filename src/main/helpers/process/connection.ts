import { ExecError } from '@gepard/common';

export const CONNECTION_FAILED = 'CONNECTION_FAILED';

const CONNECTION_FAILURE_PATTERNS: RegExp[] = [
  /could ?n.t resolve (host|proxy)/i,
  /temporary failure in name resolution/i,
  /name or service not known/i,
  /nodename nor servname provided/i,
  /no such host/i,
  /no address associated with hostname/i,
  /connection refused/i,
  /connection reset/i,
  /connection timed out/i,
  /operation timed out/i,
  /timeout was reached/i,
  /i\/o timeout/i,
  /tls handshake timeout/i,
  /context deadline exceeded/i,
  /network is unreachable/i,
  /network is down/i,
  /no route to host/i,
  /host is down/i,
  /failed to connect to/i,
  /could ?n.t connect to (server|host)/i,
  /error connecting to/i,
  /check your internet connection/i,
  /gnutls_handshake\(\) failed/i,
  /openssl ssl_connect/i,
  /ssl_error_syscall/i,
  /\b(ENOTFOUND|ECONNREFUSED|ECONNRESET|ECONNABORTED|ETIMEDOUT|EAI_AGAIN|EAI_NONAME|ENETUNREACH|ENETDOWN|EHOSTUNREACH|EHOSTDOWN)\b/,
];

export class ConnectionError extends ExecError {
  constructor(cause: ExecError) {
    super(CONNECTION_FAILED, cause.message, cause.cmd, cause.args, cause.exitCode, cause.stderr);
  }
}

export function isConnectionFailureText(text: string): boolean {
  return CONNECTION_FAILURE_PATTERNS.some((pattern) => pattern.test(text));
}

export function toConnectionError(error: unknown): ConnectionError | null {
  if (error instanceof ConnectionError) return error;
  if (!(error instanceof ExecError)) return null;
  return isConnectionFailureText(error.stderr) ? new ConnectionError(error) : null;
}
