export interface K8sConfig {
  namespace: string;
  pullSecret?: string;
}

export interface PodConfig {
  parallelism: number;
  image: string;
  command?: string[];
  args?: string[];
  injectPgConfig: boolean;
  env?: { name: string; value: string }[];
  configmaps?: string[];
  secrets?: string[];
  resources?: { limits: { cpu: string; memory: string }; requests: { cpu: string; memory: string } };
  pullPolicy: 'Always' | 'IfNotPresent' | 'Never';
}
