import type { IpcErrorShape } from '../ipc/contract';
import { AppError } from './AppError';

export class IpcError extends AppError {
  constructor(shape: IpcErrorShape, channel?: string) {
    super(shape.code, shape.message, shape.details);
    this.name = 'IpcError';
    this.channel = channel;
  }
}
