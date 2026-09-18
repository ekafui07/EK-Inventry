/**
 * Concurrency & Serialization Lock
 * Prevents race conditions on simultaneous checkouts by serializing execution.
 */
class AsyncLock {
  constructor() {
    this.queue = Promise.resolve();
  }

  acquire(fn) {
    let release;
    const next = new Promise(resolve => release = resolve);
    const result = this.queue.then(() => fn()).finally(release);
    this.queue = this.queue.then(() => next);
    return result;
  }
}

const bookingLock = new AsyncLock();

module.exports = {
  AsyncLock,
  bookingLock
};
