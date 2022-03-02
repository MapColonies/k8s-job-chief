import { StatesManager } from '../../../../../src/httpServer/states/models/statesManager';
import { QueueProvider } from '../../../../../src/queue/queueProvider';

describe('statsManager', () => {
  describe('#getStates', () => {
    it('should return the queues states', async () => {
      const getQueuesMock = jest.fn().mockResolvedValue({});
      const statesManager = new StatesManager({ getQueuesStates: getQueuesMock } as unknown as QueueProvider);
      await expect(statesManager.getStates()).resolves.toEqual({});
    });
  });
});
