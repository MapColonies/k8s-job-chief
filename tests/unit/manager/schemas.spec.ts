import { JobConfig } from '../../../src/manager/interfaces';
import { validateJobConfig } from '../../../src/manager/schemas';

const jobConfig: JobConfig = {
  queueName: 'test',
  waitTimeAfterSuccessfulRun: '1s',
  waitTimeAfterError: '1s',
  waitTimeAfterFailedRun: '1s',
  waitTimeAfterTimeout: '1s',
  jobStartTimeout: '1s',
  queueCheckInterval: '1s',
  podConfig: {
    parallelism: 1,
    injectPgConfig: false,
    liveness: { enabled: false },
    pullPolicy: 'Always',
    image: 'test',
    command: ['test'],
    args: ['test'],
    env: [],
    resources: {
      limits: {
        cpu: '1',
        memory: '1',
      },
      requests: {
        cpu: '1',
        memory: '1',
      },
    },
  },
};

describe('validateJobConfig', () => {
  it('should return an array of jobconfigs is they are valid', () => {
    const jobConfigs: JobConfig[] = [jobConfig];

    expect(validateJobConfig(jobConfigs)).toEqual(jobConfigs);
  });

  it('should throw an error if the same queue name is used twice', () => {
    const jobConfigs: JobConfig[] = [jobConfig, jobConfig];

    expect(() => validateJobConfig(jobConfigs)).toThrow(': uniqueItemProperties must pass "uniqueItemProperties" keyword validation');
  });

  it('should throw an error if the array is empty', () => {
    expect(() => validateJobConfig([])).toThrow(': minItems must NOT have fewer than 1 items');
  });
});
