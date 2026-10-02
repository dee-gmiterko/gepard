import type { ChannelName, ChannelOutput, Envelope, EventName, EventPayload } from './contract';

export interface IpcBridge {
  invoke<C extends ChannelName>(channel: C, input: unknown): Promise<Envelope<ChannelOutput<C>>>;
  on<E extends EventName>(event: E, cb: (payload: EventPayload<E>) => void): () => void;
}
