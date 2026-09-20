const { AsyncLock } = require('../src/utils/lock');

describe('AsyncLock', () => {
  it('should serialize async operations', async () => {
    const lock = new AsyncLock();
    const executionOrder = [];
    
    const task1 = lock.acquire(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      executionOrder.push(1);
    });
    
    const task2 = lock.acquire(async () => {
      executionOrder.push(2);
    });
    
    await Promise.all([task1, task2]);
    
    expect(executionOrder).toEqual([1, 2]);
  });
});
