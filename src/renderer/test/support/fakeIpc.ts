/* eslint-disable @typescript-eslint/consistent-type-assertions -- generic channel dispatch is validated at runtime against the contract schemas */
import {
  channels,
  type ChannelName,
  type ChannelOutput,
  type ChannelParsedInput,
  type Envelope,
  type EventName,
  type EventPayload,
  type IpcBridge,
} from '@gepard/common';

type Handler<C extends ChannelName> = (
  input: ChannelParsedInput<C>,
) => ChannelOutput<C> | Promise<ChannelOutput<C>>;

export type Handlers = { [C in ChannelName]?: Handler<C> };

export interface FakeIpc {
  bridge: IpcBridge;
  calls: { channel: ChannelName; input: unknown }[];
  callsTo<C extends ChannelName>(channel: C): ChannelParsedInput<C>[];
  emit<E extends EventName>(event: E, payload: EventPayload<E>): void;
}

async function dispatch<C extends ChannelName>(
  handlers: Handlers,
  channel: C,
  input: unknown,
): Promise<Envelope<ChannelOutput<C>>> {
  const handler: Handler<C> | undefined = handlers[channel];
  if (!handler) {
    return {
      ok: false,
      error: { code: 'NOT_IMPLEMENTED', message: `fake ipc has no handler for ${channel}` },
    };
  }
  try {
    const parsed = channels[channel].input.parse(input) as ChannelParsedInput<C>;
    const value = await handler(parsed);
    return { ok: true, value: channels[channel].output.parse(value) as ChannelOutput<C> };
  } catch (error) {
    console.error(`fake ipc ${channel} failed`, error);
    return {
      ok: false,
      error: {
        code: 'FAKE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export function createFakeIpc(handlers: Handlers): FakeIpc {
  const listeners = new Map<EventName, Set<(payload: never) => void>>();
  const calls: FakeIpc['calls'] = [];

  const bridge: IpcBridge = {
    invoke(channel, input) {
      calls.push({ channel, input });
      return dispatch(handlers, channel, input);
    },
    on(event, cb) {
      const set = listeners.get(event) ?? new Set();
      set.add(cb);
      listeners.set(event, set);
      return () => set.delete(cb);
    },
  };

  return {
    bridge,
    calls,
    callsTo: (channel) =>
      calls
        .filter((c) => c.channel === channel)
        .map((c) => channels[channel].input.parse(c.input) as ChannelParsedInput<typeof channel>),
    emit: (event, payload) => {
      for (const cb of listeners.get(event) ?? []) cb(payload as never);
    },
  };
}
