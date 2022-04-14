import Ajv, { JSONSchemaType } from 'ajv';
import betterAjvErrors from 'better-ajv-errors';
import * as ajvKeywords from 'ajv-keywords';
import { podConfigSchema } from '../k8s/interfaces';
import { JobConfig } from './interfaces';

export const jobConfigSchema: JSONSchemaType<JobConfig[]> = {
  type: 'array',
  minItems: 1,
  uniqueItemProperties: ['queueName'],
  items: {
    type: 'object',
    required: [
      'queueName',
      'waitTimeAfterSuccessfulRun',
      'waitTimeAfterError',
      'waitTimeAfterFailedRun',
      'jobStartTimeout',
      'waitTimeAfterTimeout',
      'podConfig',
      'queueCheckInterval',
    ],
    properties: {
      queueName: {
        type: 'string',
        minLength: 1,
      },
      podConfig: podConfigSchema,
      jobStartTimeout: {
        type: 'string',
        pattern: '^\\d+[dhms]$',
      },
      waitTimeAfterSuccessfulRun: {
        type: 'string',
        pattern: '^\\d+[dhms]$',
      },
      waitTimeAfterTimeout: {
        type: 'string',
        pattern: '^\\d+[dhms]$',
      },
      waitTimeAfterError: {
        type: 'string',
        pattern: '^\\d+[dhms]$',
      },
      waitTimeAfterFailedRun: {
        type: 'string',
        pattern: '^\\d+[dhms]$',
      },
      queueCheckInterval: {
        type: 'string',
        pattern: '^\\d+[dhms]$',
      },
    },
  },
};

export const validateJobConfig = (jobConfig: unknown): JobConfig[] => {
  const ajv = new Ajv();
  ajvKeywords.default(ajv);
  const validate = ajv.compile(jobConfigSchema);
  const valid = validate(jobConfig);
  if (!valid) {
    const message =
      validate.errors != null ? betterAjvErrors(jobConfigSchema, jobConfig, validate.errors, { format: 'js' })[0].error : 'Invalid job config';
    throw new Error(message);
  }
  return jobConfig;
};
