/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { setTimeout as setTimeoutPromise } from 'timers/promises';
import jsLogger from '@map-colonies/js-logger';
import { JobLifecycleWrapper } from '../../../src/manager/jobLifecycleWrapper';
import { JobConfig } from '../../../src/manager/interfaces';
import { PodConfig } from '../../../src/k8s/interfaces';
import { QueueProvider } from '../../../src/queue/queueProvider';

const logger = jsLogger({ enabled: false });
const jobConfig: JobConfig = {
  podConfig: {} as PodConfig,
  jobStartTimeout: '200ms',
  queueCheckInterval: '2s',
  waitTimeAfterError: '3s',
  queueName: 'test',
  waitTimeAfterFailedRun: '4s',
  waitTimeAfterSuccessfulRun: '5s',
  waitTimeAfterTimeout: '6s',
};

describe('jobLifecyleWrapper', () => {
  let lifecycleWrapper: JobLifecycleWrapper;
  let schedulerMock: { scheduleJob: jest.Mock; handleJobs: jest.Mock };
  let jobMock: { startJob: jest.Mock; shutdown: jest.Mock; once: jest.Mock; removeAllListeners: jest.Mock };
  let queueProviderMock: { isQueueEmpty: jest.Mock };
  let jobFactoryMock: jest.Mock;

  beforeAll(() => {
    jobMock = {
      startJob: jest.fn(),
      shutdown: jest.fn(),
      once: jest.fn(),
      removeAllListeners: jest.fn(),
    };

    schedulerMock = {
      scheduleJob: jest.fn(),
      handleJobs: jest.fn(),
    };

    queueProviderMock = {
      isQueueEmpty: jest.fn(),
    };

    jobFactoryMock = jest.fn();
  });

  beforeEach(() => {
    jobFactoryMock.mockReturnValue(jobMock);
    lifecycleWrapper = new JobLifecycleWrapper(jobConfig, jobFactoryMock, queueProviderMock as unknown as QueueProvider, schedulerMock, logger);
  });

  afterEach(async () => {
    jest.resetAllMocks();
    await lifecycleWrapper.stop();
  });

  it('schedule start a new job', async () => {
    queueProviderMock.isQueueEmpty.mockResolvedValue(false);
    jobMock.startJob.mockResolvedValue('jobName');

    await expect(lifecycleWrapper.start()).resolves.not.toThrow();
  });

  it('should schedule a new job if failed to check queue status', async () => {
    queueProviderMock.isQueueEmpty.mockRejectedValue(new Error('something went horribly wrong'));

    await expect(lifecycleWrapper.start()).rejects.toThrow('something went horribly wrong');
  });

  it('should schedule a new job if the queue is empty', async () => {
    queueProviderMock.isQueueEmpty.mockResolvedValue(true);
    jobMock.startJob.mockResolvedValue('jobName');

    await expect(lifecycleWrapper.start()).resolves.not.toThrow();

    expect(schedulerMock.scheduleJob).toHaveBeenCalledWith('test', 2);
  });

  it('should schedule a new job if the job start timeout was reached', async () => {
    queueProviderMock.isQueueEmpty.mockResolvedValue(false);
    jobMock.startJob.mockResolvedValue('jobName');

    await expect(lifecycleWrapper.start()).resolves.not.toThrow();
    await setTimeoutPromise(300);

    expect(schedulerMock.scheduleJob).toHaveBeenCalledWith('test', 6);
  });

  it('should schedule a new job if the job was completed succesfully', async () => {
    queueProviderMock.isQueueEmpty.mockResolvedValue(false);
    jobMock.startJob.mockResolvedValue('jobName');

    await expect(lifecycleWrapper.start()).resolves.not.toThrow();

    await jobMock.once.mock.calls.find((call) => call[0] === 'completed')[1]();

    expect(schedulerMock.scheduleJob).toHaveBeenCalledWith('test', 5);
  });

  it('should schedule a new job if the job failed', async () => {
    queueProviderMock.isQueueEmpty.mockResolvedValue(false);
    jobMock.startJob.mockResolvedValue('jobName');

    await expect(lifecycleWrapper.start()).resolves.not.toThrow();

    await jobMock.once.mock.calls.find((call) => call[0] === 'failed')[1]();

    expect(schedulerMock.scheduleJob).toHaveBeenCalledWith('test', 4);
  });

  it('should schedule a new job if didnt complete because of an error', async () => {
    queueProviderMock.isQueueEmpty.mockResolvedValue(false);
    jobMock.startJob.mockResolvedValue('jobName');

    await expect(lifecycleWrapper.start()).resolves.not.toThrow();

    await jobMock.once.mock.calls.find((call) => call[0] === 'error')[1]('job failed');

    expect(schedulerMock.scheduleJob).toHaveBeenCalledWith('test', 3);
  });

  it('should schedule a new job if starting a job has failed', async () => {
    queueProviderMock.isQueueEmpty.mockResolvedValue(false);
    jobMock.startJob.mockRejectedValue(new Error('oh noes'));

    await expect(lifecycleWrapper.start()).resolves.not.toThrow();

    expect(schedulerMock.scheduleJob).toHaveBeenCalledWith('test', 3);
  });
});
