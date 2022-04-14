import jsLogger from '@map-colonies/js-logger';
import waitForExpect from 'wait-for-expect';
import { JobManager } from '../../../src/manager/jobManager';
import { K8sJob } from '../../../src/k8s/job';
import { JobConfig } from '../../../src/manager/interfaces';
import { PodConfig } from '../../../src/k8s/interfaces';
import { QueueProvider } from '../../../src/queue/queueProvider';

const logger = jsLogger({ enabled: false });
const jobConfig: JobConfig = {
  podConfig: {} as PodConfig,
  jobStartTimeout: '1s',
  queueCheckInterval: '2s',
  waitTimeAfterError: '3s',
  queueName: 'test',
  waitTimeAfterFailedRun: '4s',
  waitTimeAfterSuccessfulRun: '5s',
  waitTimeAfterTimeout: '6s',
};

describe.skip('jobManager', () => {
  let jobManager: JobManager;
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

    queueProviderMock = {
      isQueueEmpty: jest.fn(),
    };

    jobFactoryMock = jest.fn();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jobFactoryMock.mockReturnValue(jobMock);
    jobManager = new JobManager(jobConfig, jobFactoryMock, queueProviderMock as unknown as QueueProvider, logger);
  });

  afterEach(async () => {
    jest.resetAllMocks();
    await jobManager.stop();
  });

  it.only('schedule start a new job', async () => {
    queueProviderMock.isQueueEmpty.mockResolvedValue(false);
    jobMock.startJob.mockResolvedValue('jobName');

    jobManager.start();

    await waitForExpect(() => {
      expect(jobMock.startJob).toHaveBeenCalledTimes(1);
    });
  });
  it('should schedule a new job if failed to check queue status', () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
  });
  it('should schedule a new job if the queue is empty', () => {});
  it('should schedule a new job if the job start timeout was reached', () => {});
  it('should schedule a new job if the job was completed succesfully', () => {});
  it('should schedule a new job if the job failed', () => {});
  it('should schedule a new job if didnt complete because of an error', () => {});
  it('should schedule a new job if starting a job has failed', () => {});
});
