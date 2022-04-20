import * as k8s from '@kubernetes/client-node';
import jsLogger from '@map-colonies/js-logger';
import { sub } from 'date-fns';
import { IConfig } from '../../../src/common/interfaces';
import { K8sJobCleaner } from '../../../src/k8s/jobCleaner';

const logger = jsLogger({ enabled: false });
const configMock: IConfig = {
  get: <T>(key: string): T => {
    switch (key) {
      case 'kubernetes.namespace':
        return 'default' as unknown as T;
      case 'kubernetes.jobMaxAgeForDeletion':
        return '1h' as unknown as T;
      default:
        throw new Error();
    }
  },
  has: () => true,
};

describe('k8sJobCleaner', () => {
  let listNamespacedJob: jest.Mock;
  let deleteNamespacedJob: jest.Mock;
  let k8sJobCleaner: K8sJobCleaner;

  beforeAll(() => {
    listNamespacedJob = jest.fn();
    deleteNamespacedJob = jest.fn();
  });

  beforeEach(() => {
    k8sJobCleaner = new K8sJobCleaner({ listNamespacedJob, deleteNamespacedJob } as unknown as k8s.BatchV1Api, configMock, logger, {});
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should delete all jobs that are completed and enough time has passed', async () => {
    listNamespacedJob.mockReturnValueOnce({
      body: {
        items: [
          {
            metadata: { name: 'job1' },
            status: { conditions: [{ type: 'Failed', status: 'True', lastTransitionTime: sub(Date.now(), { hours: 2 }) }] },
          },
          { metadata: { name: 'job2' }, status: { conditions: [{ type: 'Complete', status: 'True', lastTransitionTime: Date.now() }] } },
          { metadata: { name: 'job3' } },
        ],
      },
    });

    await k8sJobCleaner.clean();

    expect(deleteNamespacedJob).toHaveBeenCalledTimes(1);
    expect(deleteNamespacedJob).toHaveBeenCalledWith('job1', 'default');
  });

  it('should not delete any job if non fit the criteria', async () => {
    listNamespacedJob.mockReturnValueOnce({
      body: {
        items: [{ metadata: { name: 'job3' } }],
      },
    });

    await k8sJobCleaner.clean();

    expect(deleteNamespacedJob).toHaveBeenCalledTimes(0);
  });

  it('should not throw an error', async () => {
    listNamespacedJob.mockRejectedValueOnce(new Error());

    await expect(k8sJobCleaner.clean()).resolves.not.toThrow();
  });
});
