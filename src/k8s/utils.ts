import { dirname } from 'path';
import * as k8s from '@kubernetes/client-node';
import { DbConfig } from '../queue/pgbossFactory';
import { K8sConfig, PodConfig } from './interfaces';

export function flattenLabels(labels: Record<string, string>): string {
  return Object.entries(labels)
    .map(([key, value]) => `${key}=${value}`)
    .join(',');
}

export function createEnvFrom(configmaps?: string[], secrets?: string[]): k8s.V1EnvFromSource[] {
  return [
    ...(configmaps?.map((configmap) => ({ configMapRef: { name: configmap } })) ?? []),
    ...(secrets?.map((secret) => ({ secretRef: { name: secret } })) ?? []),
  ];
}

export function createK8sApis(fromCluster: boolean): [k8s.KubeConfig, k8s.CoreV1Api, k8s.BatchV1Api] {
  const kubeConfig = new k8s.KubeConfig();

  if (fromCluster) {
    kubeConfig.loadFromCluster();
  } else {
    kubeConfig.loadFromDefault();
  }

  return [kubeConfig, kubeConfig.makeApiClient(k8s.CoreV1Api), kubeConfig.makeApiClient(k8s.BatchV1Api)];
}

export function createJobInformer(
  kubeConfig: k8s.KubeConfig,
  k8sJobApi: k8s.BatchV1Api,
  namespace: string,
  labels: Record<string, string>
): k8s.Informer<k8s.V1Job> {
  const flattenedLabels = flattenLabels(labels);

  return k8s.makeInformer(
    kubeConfig,
    `/apis/batch/v1/namespaces/${namespace}/jobs`,
    async () => k8sJobApi.listNamespacedJob(namespace, undefined, undefined, undefined, undefined, flattenedLabels),
    flattenedLabels
  );
}

export function createJobSpec(
  instanceUid: string,
  queueName: string,
  podConfig: PodConfig,
  dbConfig: DbConfig,
  labels: Record<string, string>,
  k8sConfig: K8sConfig
): k8s.V1Job {
  const spec = {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: {
      generateName: `job-chief-${instanceUid}-${queueName}-`,
      labels: { 'queue-name': queueName, ...labels },
      namespace: k8sConfig.namespace,
    },
    spec: {
      parallelism: podConfig.parallelism,

      backoffLimit: 0,
      template: {
        metadata: {
          name: `job-chief-${queueName}-pod`,
          labels: { ...labels, 'queue-name': queueName },
        },
        spec: {
          imagePullSecrets: [{ name: k8sConfig.pullSecret }],
          restartPolicy: 'Never',
          containers: [
            {
              name: `worker`,
              image: podConfig.image,
              imagePullPolicy: podConfig.pullPolicy,
              command: podConfig.command,
              args: podConfig.args,
              env: [{ name: 'QUEUE_NAME', value: queueName }, ...(podConfig.env ?? [])],
              resources: podConfig.resources,
              envFrom: createEnvFrom(podConfig.configmaps, podConfig.secrets),
            },
          ],
        },
      },
    },
  };

  if (podConfig.liveness.enabled) {
    const specForLiveness = spec.spec.template.spec as k8s.V1PodSpec;
    specForLiveness.containers[0].livenessProbe = {
      timeoutSeconds: podConfig.liveness.timeoutSeconds,
      initialDelaySeconds: podConfig.liveness.initialDelaySeconds,
      periodSeconds: podConfig.liveness.periodSeconds,
      httpGet: {
        path: podConfig.liveness.path,
        // @ts-expect-error for some reason the type required is object, when docs says its number or string https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.19/#httpgetaction-v1-core
        port: podConfig.liveness.port,
      },
    };
  }

  if (podConfig.injectPgConfig) {
    const env = spec.spec.template.spec.containers[0].env;
    if (dbConfig.host != null) {
      env.push({ name: 'DB_HOST', value: dbConfig.host });
    }
    if (dbConfig.port != null) {
      env.push({ name: 'DB_PORT', value: dbConfig.port.toString() });
    }
    if (dbConfig.user != null) {
      env.push({ name: 'DB_USERNAME', value: dbConfig.user });
    }
    if (dbConfig.password != null) {
      env.push({ name: 'DB_PASSWORD', value: dbConfig.password });
    }
    if (dbConfig.database != null) {
      env.push({ name: 'DB_NAME', value: dbConfig.database });
    }
    if (dbConfig.schema != null) {
      env.push({ name: 'DB_SCHEMA', value: dbConfig.schema });
    }
    if (dbConfig.enableSslAuth) {
      env.push(
        { name: 'DB_ENABLE_SSL_AUTH', value: 'true' },
        { name: 'DB_CA_PATH', value: dbConfig.sslPaths.ca },
        { name: 'DB_CERT_PATH', value: dbConfig.sslPaths.cert },
        { name: 'DB_KEY_PATH', value: dbConfig.sslPaths.key }
      );
      const specForVol = spec.spec.template.spec as k8s.V1PodSpec;
      specForVol.volumes = [{ name: 'db-ssl-certs', secret: { secretName: dbConfig.certSecretName } }];
      specForVol.containers[0].volumeMounts = [{ name: 'db-ssl-certs', mountPath: dirname(dbConfig.sslPaths.ca), readOnly: true }];
    }
  }

  return spec as k8s.V1Job;
}
