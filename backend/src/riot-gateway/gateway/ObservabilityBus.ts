import { EventEmitter } from 'node:events';
import type { GatewayEvent } from '../types.js';

export class ObservabilityBus extends EventEmitter {
  emitEvent<T extends GatewayEvent>(event: T, payload: Record<string, unknown>): void {
    this.emit(event, payload);
  }
}

export const observabilityBus = new ObservabilityBus();
