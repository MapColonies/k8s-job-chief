import * as k8s from '@kubernetes/client-node';

export interface IConfig {
  get: <T>(setting: string) => T;
  has: (setting: string) => boolean;
}

export interface OpenApiConfig {
  filePath: string;
  basePath: string;
  jsonPath: string;
  uiPath: string;
}

export interface JobConfig {
  name: string;
  queueName: string;
  parallelism: number;
  image: string;
  command?: string[];
  args?: string[];
  injectPgConfig?: boolean;
  environment?: Record<string, string>;
  configmaps?: string[];
  secrets?: string[];
  resources: k8s.V1ResourceRequirements;
  pullPolicy: 'Always' | 'IfNotPresent' | 'Never';
}
