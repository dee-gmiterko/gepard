export interface IpcBridge {
  invoke(channel: string, input: unknown): Promise<unknown>;
  on(event: string, cb: (payload: unknown) => void): () => void;
}
