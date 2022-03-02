import * as k8s from '@kubernetes/client-node';
import jsLogger from '@map-colonies/js-logger';
import { K8sJob } from '../../../src/k8s/job';

jest.mock('@kubernetes/client-node');

const mockedK8s = k8s as unknown as jest.Mocked<typeof k8s>;
const kubeConfigMock = {} as k8s.KubeConfig;
const logger = jsLogger({ enabled: false });
const jobSpecMock = {} as k8s.V1Job;
const namespace = 'default';
const queueName = 'queue';

describe('K8sJob', () => {
  let createNamespacedJobMock: jest.Mock;
  let deleteNamespacedJobMock: jest.Mock;
  let podInformerMock: { on: jest.Mock; start: jest.Mock; stop: jest.Mock; off: jest.Mock };
  let jobInformerMock: { on: jest.Mock; off: jest.Mock };
  let k8sJob: K8sJob;

  beforeAll(() => {
    createNamespacedJobMock = jest.fn();
    deleteNamespacedJobMock = jest.fn();
    jobInformerMock = {
      on: jest.fn(),
      off: jest.fn(),
    };
    podInformerMock = {
      on: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      off: jest.fn(),
    };
  });

  beforeEach(() => {
    mockedK8s.makeInformer.mockReturnValue(podInformerMock);
    k8sJob = new K8sJob(
      kubeConfigMock,
      { listNamespacedPod: jest.fn() } as unknown as k8s.CoreV1Api,
      { createNamespacedJob: createNamespacedJobMock, deleteNamespacedJob: deleteNamespacedJobMock } as unknown as k8s.BatchV1Api,
      jobInformerMock as unknown as k8s.Informer<k8s.V1Job>,
      jobSpecMock,
      namespace,
      queueName,
      logger
    );
  });

  afterEach(() => {
    k8sJob.removeAllListeners();
    jest.resetAllMocks();
  });

  describe('startJob', () => {
    it('should return the created job name', async () => {
      createNamespacedJobMock.mockResolvedValue({ body: { metadata: { name: 'job-name' } } });

      const jobName = await k8sJob.startJob();

      expect(jobName).toBe('job-name');
    });

    it('should throw an error if the job already started', async () => {
      createNamespacedJobMock.mockResolvedValue({ body: { metadata: { name: 'job-name' } } });
      await k8sJob.startJob();

      await expect(k8sJob.startJob()).rejects.toThrow('job already started');
    });

    it('should throw an error if createNamespacedJob throws one', async () => {
      createNamespacedJobMock.mockRejectedValue(new Error('createNamespacedJob error'));

      await expect(k8sJob.startJob()).rejects.toThrow('createNamespacedJob error');
    });
  });

  describe('shutdown', () => {
    it('should resolve without errors', async () => {
      await expect(k8sJob.shutdown()).resolves.not.toThrow();
    });

    it('should unregister the handler from the job informer', async () => {
      createNamespacedJobMock.mockResolvedValue({ body: { metadata: { name: 'job-name' } } });
      await k8sJob.startJob();

      await k8sJob.shutdown();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(jobInformerMock.off).toHaveBeenCalledWith('update', jobInformerMock.on.mock.calls[0][1]);
    });
  });

  describe('deleteJob', () => {
    it('should resolve without errors if the job already started', async () => {
      createNamespacedJobMock.mockResolvedValue({ body: { metadata: { name: 'job-name' } } });
      await k8sJob.startJob();

      await expect(k8sJob.deleteJob()).resolves.not.toThrow();
    });

    it('should throw an error if deleteNamespacedJob throws', async () => {
      createNamespacedJobMock.mockResolvedValue({ body: { metadata: { name: 'job-name' } } });
      deleteNamespacedJobMock.mockRejectedValue(new Error('deleteNamespacedJob error'));
      await k8sJob.startJob();

      await expect(k8sJob.deleteJob()).rejects.toThrow('deleteNamespacedJob error');
    });

    it('should throw an error if the job has not started', async () => {
      await expect(k8sJob.deleteJob()).rejects.toThrow('job not started');
    });
  });

  describe('Pod Events', () => {
    it('should emit an error if a pod is failing because of a CrasbLoopBackOff', async () => {
      createNamespacedJobMock.mockResolvedValue({ body: { metadata: { name: 'job-name' } } });
      await k8sJob.startJob();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const podInformerHandler = podInformerMock.on.mock.calls[0][1] as k8s.ObjectCallback<k8s.V1Pod>;
      const onError = jest.fn();
      k8sJob.on('error', onError);

      podInformerHandler({
        status: { phase: 'Pending', containerStatuses: [{ state: { waiting: { reason: 'CrashLoopBackOff' } } } as k8s.V1ContainerStatus] },
      });

      expect(onError).toHaveBeenCalledWith('CrashLoopBackOff', 'unknown');
    });

    it('should emit an error if a pod is failing because of an error', async () => {
      createNamespacedJobMock.mockResolvedValue({ body: { metadata: { name: 'job-name' } } });
      await k8sJob.startJob();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const podInformerHandler = podInformerMock.on.mock.calls[0][1] as k8s.ObjectCallback<k8s.V1Pod>;

      const onError = jest.fn();
      k8sJob.on('error', onError);

      podInformerHandler({
        status: {
          phase: 'Pending',
          containerStatuses: [{ state: { waiting: { reason: 'ErrImagePull', message: 'err' } } } as k8s.V1ContainerStatus],
        },
      });

      expect(onError).toHaveBeenCalledWith('ErrImagePull', 'err');
    });

    it('should emit started event when the first pod is running', async () => {
      createNamespacedJobMock.mockResolvedValue({ body: { metadata: { name: 'job-name' } } });
      await k8sJob.startJob();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const podInformerHandler = podInformerMock.on.mock.calls[0][1] as k8s.ObjectCallback<k8s.V1Pod>;
      const onStarted = jest.fn();
      k8sJob.on('started', onStarted);
      podInformerHandler({
        status: { phase: 'Running' },
      });

      expect(onStarted).toHaveBeenCalledTimes(1);
    });

    it('should not emit started more than once', async () => {
      createNamespacedJobMock.mockResolvedValue({ body: { metadata: { name: 'job-name' } } });
      await k8sJob.startJob();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const podInformerHandler = podInformerMock.on.mock.calls[0][1] as k8s.ObjectCallback<k8s.V1Pod>;
      const onStarted = jest.fn();
      k8sJob.on('started', onStarted);
      podInformerHandler({
        status: { phase: 'Running' },
      });
      podInformerHandler({
        status: { phase: 'Running' },
      });

      expect(onStarted).toHaveBeenCalledTimes(1);
    });
  });

  describe('Job Events', () => {
    it('should not emit an event if the job hasnt started', () => {
      createNamespacedJobMock.mockResolvedValue({ body: { metadata: { name: 'job-name' } } });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const jobInformerUpdateHandler = jobInformerMock.on.mock.calls.find(
        (v: [string, unknown]) => v[0] === 'update'
      )[1] as k8s.ObjectCallback<k8s.V1Job>;

      const eventHandler = jest.fn();
      k8sJob.on('completed', eventHandler);
      k8sJob.on('failed', eventHandler);

      jobInformerUpdateHandler({ metadata: { name: 'job-name' }, status: { conditions: [{ type: 'Complete', status: 'True' }] } });

      expect(eventHandler).toHaveBeenCalledTimes(0);
    });

    it('should not emit if the event is for a different job', async () => {
      createNamespacedJobMock.mockResolvedValue({ body: { metadata: { name: 'job-name' } } });
      await k8sJob.startJob();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const jobInformerUpdateHandler = jobInformerMock.on.mock.calls.find(
        (v: [string, unknown]) => v[0] === 'update'
      )[1] as k8s.ObjectCallback<k8s.V1Job>;

      const eventHandler = jest.fn();
      k8sJob.on('completed', eventHandler);
      k8sJob.on('failed', eventHandler);

      jobInformerUpdateHandler({ metadata: { name: 'job-2' }, status: { conditions: [{ type: 'Complete', status: 'True' }] } });

      expect(eventHandler).toHaveBeenCalledTimes(0);
    });

    it('should emit completed and unregister the handler if the job was completed', async () => {
      createNamespacedJobMock.mockResolvedValue({ body: { metadata: { name: 'job-name' } } });
      await k8sJob.startJob();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const jobInformerUpdateHandler = jobInformerMock.on.mock.calls.find(
        (v: [string, unknown]) => v[0] === 'update'
      )[1] as k8s.ObjectCallback<k8s.V1Job>;

      const eventHandler = jest.fn();
      k8sJob.on('completed', eventHandler);

      jobInformerUpdateHandler({ metadata: { name: 'job-name' }, status: { conditions: [{ type: 'Complete', status: 'True' }] } });

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(jobInformerMock.off).toHaveBeenCalledWith('update', jobInformerUpdateHandler);
    });

    it('should emit failed and unregister the handler if the job failed', async () => {
      createNamespacedJobMock.mockResolvedValue({ body: { metadata: { name: 'job-name' } } });
      await k8sJob.startJob();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const jobInformerUpdateHandler = jobInformerMock.on.mock.calls.find(
        (v: [string, unknown]) => v[0] === 'update'
      )[1] as k8s.ObjectCallback<k8s.V1Job>;

      const eventHandler = jest.fn();
      k8sJob.on('failed', eventHandler);

      jobInformerUpdateHandler({ metadata: { name: 'job-name' }, status: { conditions: [{ type: 'Failed', status: 'True', reason: 'Err' }] } });

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith('Err');
      expect(jobInformerMock.off).toHaveBeenCalledWith('update', jobInformerUpdateHandler);
    });

    it('should emit failed if the job was deleted', async () => {
      createNamespacedJobMock.mockResolvedValue({ body: { metadata: { name: 'job-name' } } });
      await k8sJob.startJob();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const jobInformerUpdateHandler = jobInformerMock.on.mock.calls.find(
        (v: [string, unknown]) => v[0] === 'delete'
      )[1] as k8s.ObjectCallback<k8s.V1Job>;

      const eventHandler = jest.fn();
      k8sJob.on('failed', eventHandler);

      jobInformerUpdateHandler({ metadata: { name: 'job-name' } });

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith('Job deleted');
      expect(jobInformerMock.off).toHaveBeenCalledWith('delete', jobInformerUpdateHandler);
    });

    it('should not emit failed if the job was already deleted', async () => {
      createNamespacedJobMock.mockResolvedValue({ body: { metadata: { name: 'job-name' } } });
      await k8sJob.startJob();
      await k8sJob.deleteJob();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const jobInformerUpdateHandler = jobInformerMock.on.mock.calls.find(
        (v: [string, unknown]) => v[0] === 'delete'
      )[1] as k8s.ObjectCallback<k8s.V1Job>;

      const eventHandler = jest.fn();
      k8sJob.on('failed', eventHandler);

      jobInformerUpdateHandler({ metadata: { name: 'job-name' } });

      expect(eventHandler).toHaveBeenCalledTimes(0);
    });

    it('should not emit failed if a different job was deleted', async () => {
      createNamespacedJobMock.mockResolvedValue({ body: { metadata: { name: 'job-name' } } });
      await k8sJob.startJob();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const jobInformerUpdateHandler = jobInformerMock.on.mock.calls.find(
        (v: [string, unknown]) => v[0] === 'delete'
      )[1] as k8s.ObjectCallback<k8s.V1Job>;

      const eventHandler = jest.fn();
      k8sJob.on('failed', eventHandler);

      jobInformerUpdateHandler({ metadata: { name: 'job-name2' } });

      expect(eventHandler).toHaveBeenCalledTimes(0);
    });
  });
});
