import type { QueuedRequest } from '../types.js';

export class RequestQueue {
  private readonly items: QueuedRequest[] = [];

  enqueue<T>(request: QueuedRequest<T>): void {
    if (request.priority === 'high') {
      const firstNormal = this.items.findIndex((item) => item.priority === 'normal');
      if (firstNormal === -1) {
        this.items.unshift(request as QueuedRequest);
      } else {
        this.items.splice(firstNormal, 0, request as QueuedRequest);
      }
      return;
    }
    this.items.push(request as QueuedRequest);
  }

  dequeue(): QueuedRequest | undefined {
    return this.items.shift();
  }

  size(): number {
    return this.items.length;
  }

  highPriorityCount(): number {
    return this.items.filter((item) => item.priority === 'high').length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  snapshot(): QueuedRequest[] {
    return [...this.items];
  }

  clear(): QueuedRequest[] {
    const pending = [...this.items];
    this.items.length = 0;
    return pending;
  }
}
