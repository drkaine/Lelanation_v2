import type { GatewayRequest } from './types.js'

export class RequestQueue<T = unknown> {
  private readonly queue: GatewayRequest<T>[] = []

  enqueue(req: GatewayRequest<T>): void {
    this.queue.push(req)
  }

  enqueueFront(req: GatewayRequest<T>): void {
    this.queue.unshift(req)
  }

  dequeue(): GatewayRequest<T> | undefined {
    return this.queue.shift()
  }

  size(): number {
    return this.queue.length
  }

  isEmpty(): boolean {
    return this.queue.length === 0
  }

  drain(): GatewayRequest<T>[] {
    const items = this.queue.slice()
    this.queue.length = 0
    return items
  }
}
