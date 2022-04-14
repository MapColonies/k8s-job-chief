import jsLogger from '@map-colonies/js-logger';
import PgBoss from 'pg-boss';
import { JobConfig } from '../../../src/manager/interfaces';
import { PgBossQueueProvider } from '../../../src/queue/pgbossQueueProvider';

describe('PgBossQueueProvider', () => {
  let provider: PgBossQueueProvider;
  let pgbossMock: { on: jest.Mock; start: jest.Mock; stop: jest.Mock; getQueueSize: jest.Mock };
  const jobConfig: JobConfig = {
    queueName: 'test',
  } as JobConfig;
  beforeAll(() => {
    pgbossMock = {
      on: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      getQueueSize: jest.fn(),
    };
  });

  beforeEach(() => {
    provider = new PgBossQueueProvider(pgbossMock as unknown as PgBoss, jsLogger({ enabled: false }), [jobConfig]);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should start pg-boss', async () => {
    await expect(provider.startQueue()).resolves.not.toThrow();
  });

  it('should stop the queue', async () => {
    await expect(provider.stopQueue()).resolves.not.toThrow();
  });

  it('should return true if the queue is empty', async () => {
    pgbossMock.getQueueSize.mockResolvedValue(0);
    await expect(provider.isQueueEmpty('test')).resolves.toBe(true);
  });

  it('should return false if the queue is not empty', async () => {
    pgbossMock.getQueueSize.mockResolvedValue(1);
    await expect(provider.isQueueEmpty('test')).resolves.toBe(false);
  });

  it('return states about the queues', async () => {
    const states: PgBoss.MonitorStates = {
      active: 2,
      all: 2,
      cancelled: 2,
      completed: 2,
      failed: 2,
      created: 2,
      expired: 2,
      retry: 2,
      queues: {
        test: {
          active: 0,
          all: 0,
          cancelled: 0,
          completed: 0,
          failed: 0,
          created: 0,
          expired: 0,
          retry: 0,
        },
        internal: {
          active: 1,
          all: 1,
          cancelled: 1,
          completed: 1,
          failed: 1,
          created: 1,
          expired: 1,
          retry: 1,
        },
      },
    };
    await provider.startQueue();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const monitorStatesHandler = pgbossMock.on.mock.calls[1][1] as unknown as (states: PgBoss.MonitorStates) => void;

    await expect(provider.getQueuesStates()).resolves.toEqual({});
    monitorStatesHandler(states);
    await expect(provider.getQueuesStates()).resolves.toEqual({ test: states.queues.test });
  });
});
