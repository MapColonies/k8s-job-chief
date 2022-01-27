import { DependencyContainer } from 'tsyringe';
import * as k8s from '@kubernetes/client-node';
import { IConfig } from 'config';
import { SERVICES } from '../common/constants';
import { Job } from './job';
import { JobConfig, K8sConfig } from './interfaces';

export const jobFactory = (container: DependencyContainer): ((jobConfig: JobConfig, initTimeoutMs: number) => Job) => {
  const config = container.resolve<IConfig>(SERVICES.CONFIG);
  const instanceUid = config.get<string>("app.instanceUid");
  const k8sConfig = config.get<K8sConfig>('kubernetes');
  const kubeConfig = container.resolve<k8s.KubeConfig>(SERVICES.KUBE_CONFIG);
  const k8sApi = container.resolve<k8s.CoreV1Api>(SERVICES.K8S_API);
  const k8sJobApi = container.resolve<k8s.BatchV1Api>(SERVICES.K8S_JOB_API);
  const jobInformer = container.resolve<k8s.Informer<k8s.V1Job>>(SERVICES.K8S_JOB_INFORMER);

  return (jobConfig: JobConfig, initTimeoutMs: number): Job => {
    const jobSpec: k8s.V1Job = {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        generateName: `job-chief-${instanceUid}-${jobConfig.queueName}-`,
        labels: {},
        namespace: k8sConfig.namespace,
      },
      spec: {
        parallelism: jobConfig.parallelism,
        backoffLimit: 0,
        template: {
          metadata: {
            name: `job-chief-${jobConfig.queueName}-pod`,
          },
        },
      },
    };
    return new Job(kubeConfig, k8sApi, k8sJobApi, jobInformer, jobSpec, jobConfig.queueName, initTimeoutMs);
  };
};
