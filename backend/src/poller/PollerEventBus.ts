import { EventEmitter } from 'node:events';
import type { PollerEvents } from './types.js';

export class PollerEventBus extends EventEmitter {
  emit<K extends keyof PollerEvents>(event: K, payload: PollerEvents[K]): boolean {
    return super.emit(event, payload);
  }

  on<K extends keyof PollerEvents>(event: K, listener: (payload: PollerEvents[K]) => void): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  once<K extends keyof PollerEvents>(event: K, listener: (payload: PollerEvents[K]) => void): this {
    return super.once(event, listener as (...args: unknown[]) => void);
  }

  off<K extends keyof PollerEvents>(event: K, listener: (payload: PollerEvents[K]) => void): this {
    return super.off(event, listener as (...args: unknown[]) => void);
  }
}
