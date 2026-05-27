export class QueueClosedError extends Error {
  constructor(message = 'AsyncQueue is closed') {
    super(message)
    this.name = 'QueueClosedError'
  }
}

type DequeueWaiter<T> = {
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

export class AsyncQueue<T> {
  private readonly items: T[] = []
  private readonly waiters: DequeueWaiter<T>[] = []
  private readonly pushWaiters: Array<() => void> = []
  private closed = false

  constructor(private readonly capacity: number) {}

  async enqueue(item: T): Promise<void> {
    if (this.closed) throw new QueueClosedError()
    while (!this.closed && this.items.length >= this.capacity) {
      await new Promise<void>((resolve) => this.pushWaiters.push(resolve))
    }
    if (this.closed) throw new QueueClosedError()

    const waiter = this.waiters.shift()
    if (waiter) {
      waiter.resolve(item)
      return
    }
    this.items.push(item)
  }

  async dequeue(): Promise<T> {
    if (this.items.length > 0) {
      const item = this.items.shift()!
      const pushWaiter = this.pushWaiters.shift()
      if (pushWaiter) pushWaiter()
      return item
    }
    if (this.closed) throw new QueueClosedError()

    return new Promise<T>((resolve, reject) => {
      this.waiters.push({ resolve, reject })
    })
  }

  close(): void {
    this.closed = true
    const error = new QueueClosedError()
    while (this.waiters.length > 0) {
      this.waiters.shift()!.reject(error)
    }
    while (this.pushWaiters.length > 0) {
      this.pushWaiters.shift()!()
    }
  }

  size(): number {
    return this.items.length
  }

  isEmpty(): boolean {
    return this.items.length === 0
  }
}
