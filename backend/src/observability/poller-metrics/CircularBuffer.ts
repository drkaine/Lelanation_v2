export class CircularBuffer<T extends { ts: number }> {
  private readonly buf: Array<T | undefined>;
  private head = 0;
  private _size = 0;

  constructor(private readonly capacity: number) {
    this.buf = new Array(capacity);
  }

  push(item: T): void {
    this.buf[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this._size < this.capacity) this._size += 1;
  }

  inWindow(windowMs: number, now = Date.now()): T[] {
    if (windowMs <= 0) return [];
    const cutoff = now - windowMs;
    const result: T[] = [];
    for (let i = 0; i < this._size; i += 1) {
      const idx = (this.head - 1 - i + this.capacity) % this.capacity;
      const item = this.buf[idx];
      if (!item) continue;
      if (item.ts < cutoff) break;
      result.push(item);
    }
    return result;
  }

  latest(): T | null {
    if (this._size === 0) return null;
    return this.buf[(this.head - 1 + this.capacity) % this.capacity] ?? null;
  }

  get size(): number {
    return this._size;
  }

  get isFull(): boolean {
    return this._size === this.capacity;
  }
}
