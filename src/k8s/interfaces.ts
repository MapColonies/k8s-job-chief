import { JSONSchemaType } from 'ajv';

export interface K8sConfig {
  namespace: string;
  pullSecret?: string;
  loadConfigFromCluster: boolean;
}

export interface PodConfig {
  parallelism: number;
  image: string;
  command?: string[];
  args?: string[];
  annotations?: Record<string, string>;
  injectPgConfig: boolean;
  env?: { name: string; value: string }[];
  configmaps?: string[];
  secrets?: string[];
  resources?: { limits: { cpu: string; memory: string }; requests: { cpu: string; memory: string } };
  liveness:
    | {
        enabled: false;
      }
    | { enabled: true; path: string; port: number; initialDelaySeconds: number; periodSeconds: number; timeoutSeconds: number };
  pullPolicy: 'Always' | 'IfNotPresent' | 'Never';
}

export const podConfigSchema: JSONSchemaType<PodConfig> = {
  type: 'object',
  properties: {
    parallelism: {
      type: 'integer',
      minimum: 1,
      maximum: 30,
    },
    annotations: {
      nullable: true,
      type: 'object',
      required: [],
      additionalProperties: {
        type: 'string',
      },
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
    liveness: {
      type: 'object',
      required: ['enabled'],
      if: { properties: { enabled: { const: true } } },
      then: {
        required: ['path', 'port', 'initialDelaySeconds', 'periodSeconds', 'timeoutSeconds'],
      },
      properties: {
        enabled: {
          type: 'boolean',
        },
        path: {
          type: 'string',
        },
        port: {
          type: 'integer',
          minimum: 1,
          maximum: 65535,
        },
        initialDelaySeconds: {
          type: 'integer',
          minimum: 0,
          maximum: 300,
        },
        periodSeconds: {
          type: 'integer',
          minimum: 1,
          maximum: 300,
        },
        timeoutSeconds: {
          type: 'integer',
          minimum: 1,
          maximum: 300,
        },
      },
    },
  },
  required: ['injectPgConfig', 'pullPolicy', 'parallelism', 'image', 'liveness'],
};
