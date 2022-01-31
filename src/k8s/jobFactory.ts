import { DependencyContainer } from 'tsyringe';
import * as k8s from '@kubernetes/client-node';
import { IConfig } from 'config';
import { SERVICES } from '../common/constants';
import { Job } from './job';
import { JobConfig, K8sConfig } from './interfaces';
import { createEnvFrom } from './utils';
import { JOB_LABELS_SYMBOL } from './constants';

function createJobSpec(instanceUid: string, jobConfig: JobConfig, labels: Record<string, string>, k8sConfig: K8sConfig): k8s.V1Job {
  console.log(labels);

  return {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: {
      generateName: `job-chief-${instanceUid}-${jobConfig.queueName}-`,
      labels: { 'queue-name': jobConfig.queueName, ...labels },
      namespace: k8sConfig.namespace,
    },
    spec: {
      parallelism: jobConfig.parallelism,

      backoffLimit: 0,
      template: {
        metadata: {
          name: `job-chief-${jobConfig.queueName}-pod`,
          labels: { ...labels, 'queue-name': jobConfig.queueName },
        },
        spec: {
          imagePullSecrets: [{ name: k8sConfig.pullSecret }],
          restartPolicy: 'Never',
          containers: [
            {
              name: `worker`,
              image: jobConfig.image,
              imagePullPolicy: jobConfig.pullPolicy,
              command: jobConfig.command,
              args: jobConfig.args,
              env: jobConfig.env,
              resources: jobConfig.resources,
              envFrom: createEnvFrom(jobConfig.configmaps, jobConfig.secrets),
            },
          ],
        },
      },
    },
  };
}
export type JobFactory = (jobConfig: JobConfig, initTimeoutMs: number) => Job;

export const jobFactoryForDi = (container: DependencyContainer): JobFactory => {
  const config = container.resolve<IConfig>(SERVICES.CONFIG);
  const instanceUid = config.get<string>('app.instanceUid');
  const k8sConfig = config.get<K8sConfig>('kubernetes');
  const kubeConfig = container.resolve<k8s.KubeConfig>(SERVICES.K8S_CONFIG);
  const k8sApi = container.resolve<k8s.CoreV1Api>(SERVICES.K8S_API);
  const k8sJobApi = container.resolve<k8s.BatchV1Api>(SERVICES.K8S_JOB_API);
  const jobInformer = container.resolve<k8s.Informer<k8s.V1Job>>(SERVICES.K8S_JOB_INFORMER);
  const labels = container.resolve<Record<string, string>>(JOB_LABELS_SYMBOL);

  return (jobConfig: JobConfig, initTimeoutMs: number): Job => {
    const jobSpec: k8s.V1Job = createJobSpec(instanceUid, jobConfig, labels, k8sConfig);
    return new Job(kubeConfig, k8sApi, k8sJobApi, jobInformer, jobSpec, k8sConfig.namespace, initTimeoutMs);
  };
};
