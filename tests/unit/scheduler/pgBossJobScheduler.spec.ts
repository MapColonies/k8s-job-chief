import PgBoss from 'pg-boss';
import { PgBossJobScheduler } from '../../../src/scheduler/pgBossJobScheduler';

describe('pgBossJobScheduler', function () {
  describe('#scheduleJob', function () {
    let pgBossMock: jest.Mocked<PgBoss>;
    beforeAll(() => {
      pgBossMock = {
        send: jest.fn(),
      } as unknown as jest.Mocked<PgBoss>;
    });

    it('should send the job to pgboss', async () => {
      const scheduler = new PgBossJobScheduler(pgBossMock);

      await expect(scheduler.scheduleJob('test', 0)).resolves.not.toThrow();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(pgBossMock.send).toHaveBeenCalledWith('k8s-job-starts', { name: 'test' }, { singletonKey: 'test', startAfter: 0 });
    });
  });

  describe('#handleJobs', function () {
    let pgBossMock: { fetch: jest.Mock; complete: jest.Mock };
    beforeAll(() => {
      pgBossMock = {
        fetch: jest.fn(),
        complete: jest.fn(),
      };
    });

    it('should call the handler if there is a scheduled job', async () => {
      const scheduler = new PgBossJobScheduler(pgBossMock as unknown as PgBoss);
      const handler = jest.fn();
      const abortController = new AbortController();
      pgBossMock.fetch.mockResolvedValue({ id: 'test', name: 'test', data: { name: 'test' } });

      setTimeout(() => abortController.abort(), 1100);

      await expect(scheduler.handleJobs(handler, abortController.signal)).rejects.toThrow('The operation was aborted');

      expect(handler).toHaveBeenCalledWith({ name: 'test' });
    });

    it('should not call the handler if there is no scheduled job', async () => {
      const scheduler = new PgBossJobScheduler(pgBossMock as unknown as PgBoss);
      const handler = jest.fn();
      const abortController = new AbortController();
      pgBossMock.fetch.mockResolvedValue(null);

      setTimeout(() => abortController.abort(), 1100);

      await expect(scheduler.handleJobs(handler, abortController.signal)).rejects.toThrow('The operation was aborted');

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
