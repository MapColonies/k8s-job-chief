import Ajv, { JSONSchemaType } from 'ajv';
import betterAjvErrors from 'better-ajv-errors';
import * as ajvKeywords from 'ajv-keywords';
import { PodConfig } from '../k8s/interfaces';
import { JobConfig } from './interfaces';

const podConfigSchema: JSONSchemaType<PodConfig> = {
  type: 'object',
  properties: {
    parallelism: {
      type: 'integer',
      minimum: 1,
      maximum: 30,
    },
    image: {
      type: 'string',
    },
    command: { items: { type: 'string' }, type: 'array', nullable: true },
    args: { items: { type: 'string' }, type: 'array', nullable: true },
    injectPgConfig: {
      type: 'boolean',
    },
    env: {
      type: 'array',
      nullable: true,
      items: {
        type: 'object',
        required: ['name', 'value'],
        properties: {
          name: {
            type: 'string',
          },
          value: {
            type: 'string',
          },
        },
      },
    },
    configmaps: { items: { type: 'string' }, type: 'array', nullable: true },
    secrets: { items: { type: 'string' }, type: 'array', nullable: true },
    resources: {
      type: 'object',
      required: ['limits', 'requests'],
      nullable: true,
      properties: {
        limits: {
          type: 'object',
          required: ['cpu', 'memory'],
          properties: {
            cpu: {
              type: 'string',
            },
            memory: {
              type: 'string',
            },
          },
        },
        requests: {
          type: 'object',
          required: ['cpu', 'memory'],
          properties: {
            cpu: {
              type: 'string',
            },
            memory: {
              type: 'string',
            },
          },
        },
      },
    },
    pullPolicy: {
      type: 'string',
      enum: ['Always', 'IfNotPresent', 'Never'],
    },
  },
  required: ['injectPgConfig', 'pullPolicy', 'parallelism', 'image'],
};

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
