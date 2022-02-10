import { StatsManager } from '../../../../../src/httpServer/stats/models/statsManager';
import { QueueProvider } from '../../../../../src/queue/queueProvider';

describe('statsManager', () => {
  describe('#getStats', () => {
    it('should return the queues stats', async () => {
      const getQueuesMock = jest.fn().mockResolvedValue({});
      const statsManager = new StatsManager({ getQueuesStats: getQueuesMock } as unknown as QueueProvider);

      await expect(statsManager.getStats()).resolves.toEqual({});
    });
  });
});
