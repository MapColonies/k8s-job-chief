import * as k8s from '@kubernetes/client-node';

export const flattenLabels = (labels: Record<string, string>): string => {
  return Object.entries(labels)
    .map(([key, value]) => `${key}=${value}`)
    .join(',');
};

export const createEnvFrom = (configmaps?: string[], secrets?: string[]): k8s.V1EnvFromSource[] => {
  return [
    ...(configmaps?.map((configmap) => ({ configMapRef: { name: configmap } })) ?? []),
    ...(secrets?.map((secret) => ({ secretRef: { name: secret } })) ?? []),
  ];
};
