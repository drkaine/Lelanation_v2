import type { LimitChangeEvent } from './types.js';

export class LimitChangeDetector {
  private last120s = 0;
  private last1s = 0;
  private history: LimitChangeEvent[] = [];

  private readonly hysteresis: number;

  constructor(hysteresis = 0.05) {
    this.hysteresis = hysteresis;
  }

  check(current120s: number, current1s: number): LimitChangeEvent | null {
    if (this.last120s === 0) {
      this.last120s = current120s;
      this.last1s = current1s;
      return null;
    }

    const delta120s = Math.abs(current120s - this.last120s) / this.last120s;
    const delta1s = Math.abs(current1s - this.last1s) / this.last1s;

    if (delta120s <= this.hysteresis && delta1s <= this.hysteresis) {
      return null;
    }

    const event: LimitChangeEvent = {
      ts: Date.now(),
      previous120s: this.last120s,
      current120s,
      previous1s: this.last1s,
      current1s,
      ratio: current120s / this.last120s,
    };

    this.last120s = current120s;
    this.last1s = current1s;
    this.history = [...this.history.slice(-9), event];
    return event;
  }

  getHistory(): LimitChangeEvent[] {
    return this.history;
  }

  reset(): void {
    this.last120s = 0;
    this.last1s = 0;
    this.history = [];
  }
}
