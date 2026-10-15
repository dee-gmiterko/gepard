import { z } from 'zod';
import type { Envelope } from './contract';

export const SOCKET_PATH = '/ipc';

export const SocketClientMessage = z.object({
  type: z.literal('invoke'),
  id: z.int().nonnegative(),
  channel: z.string().min(1),
  input: z.unknown().optional(),
});
export type SocketClientMessage = z.infer<typeof SocketClientMessage>;

const SocketEnvelope = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: z.unknown().optional() }),
  z.object({
    ok: z.literal(false),
    error: z.object({
      kind: z.string().optional(),
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  }),
]);

const SocketServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('result'), id: z.int().nonnegative(), envelope: SocketEnvelope }),
  z.object({ type: z.literal('event'), event: z.string().min(1), payload: z.unknown().optional() }),
]);

export type SocketServerMessage =
  | { type: 'result'; id: number; envelope: Envelope<unknown> }
  | { type: 'event'; event: string; payload: unknown };

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function parseSocketClientMessage(text: string): SocketClientMessage | null {
  const parsed = SocketClientMessage.safeParse(parseJson(text));
  return parsed.success ? parsed.data : null;
}

export function parseSocketServerMessage(text: string): SocketServerMessage | null {
  const parsed = SocketServerMessageSchema.safeParse(parseJson(text));
  if (!parsed.success) return null;
  const message = parsed.data;
  if (message.type === 'event')
    return { type: 'event', event: message.event, payload: message.payload };
  const envelope: Envelope<unknown> = message.envelope.ok
    ? { ok: true, value: message.envelope.value }
    : { ok: false, error: message.envelope.error };
  return { type: 'result', id: message.id, envelope };
}

export function serializeResult(id: number, envelope: Envelope<unknown>): string {
  return JSON.stringify({ type: 'result', id, envelope });
}

export function serializeEvent(event: string, payload: unknown): string {
  return JSON.stringify({ type: 'event', event, payload });
}

export function serializeInvoke(id: number, channel: string, input: unknown): string {
  return JSON.stringify({ type: 'invoke', id, channel, input });
}
