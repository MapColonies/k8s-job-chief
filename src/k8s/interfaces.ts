import * as k8s from '@kubernetes/client-node';

export interface K8sConfig {
  namespace: string;
  pullSecret?: string;
}

export interface JobConfig {
  queueName: string;
  parallelism: number;
  image: string;
  command?: string[];
  args?: string[];
  injectPgConfig?: boolean;
  environment?: Record<string, string>;
  configmaps?: string[];
  secrets?: string[];
  resources?: k8s.V1ResourceRequirements;
  pullPolicy: 'Always' | 'IfNotPresent' | 'Never';
}
