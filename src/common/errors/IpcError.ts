import type { IpcErrorShape } from '../ipc/contract';

export class IpcError extends Error {
  code: string;
  details?: unknown;
  channel?: string;
  constructor(shape: IpcErrorShape, channel?: string) {
    super(shape.message);
    this.name = 'IpcError';
    this.code = shape.code;
    this.details = shape.details;
    this.channel = channel;
  }
}
