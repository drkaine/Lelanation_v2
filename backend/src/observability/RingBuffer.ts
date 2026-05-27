export class RingBuffer<T extends { ts: number }> {
  private readonly buf: Array<T | undefined>
  private head = 0
  private currentSize = 0

  constructor(private readonly capacity: number) {
    this.buf = new Array(capacity)
  }

  push(item: T): void {
    this.buf[this.head % this.capacity] = item
    this.head += 1
    if (this.currentSize < this.capacity) this.currentSize += 1
  }

  since(sinceMs: number): T[] {
    const result: T[] = []
    const len = Math.min(this.currentSize, this.capacity)
    for (let i = len - 1; i >= 0; i -= 1) {
      const idx = ((this.head - 1 - i) + this.capacity * 2) % this.capacity
      const item = this.buf[idx]
      if (item && item.ts >= sinceMs) result.push(item)
    }
    return result
  }

  last(n: number): T[] {
    const all = this.since(0)
    return all.slice(Math.max(0, all.length - n))
  }

  size(): number {
    return this.currentSize
  }
}
