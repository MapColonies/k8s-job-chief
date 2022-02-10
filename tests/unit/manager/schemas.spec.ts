import { JobConfig } from '../../../src/manager/interfaces';
import { validateJobConfig } from '../../../src/manager/schemas';

describe('validateJobConfig', () => {
  it('should return an array of jobconfigs is they are valid', () => {
    const jobConfig: JobConfig[] = [
      {
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
      },
    ];

    expect(validateJobConfig(jobConfig)).toEqual(jobConfig);
  });

  it('should throw an error if the array is empty', () => {
    expect(() => validateJobConfig([])).toThrow(': minItems must NOT have fewer than 1 items');
  });
});
