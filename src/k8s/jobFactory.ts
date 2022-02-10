import { Logger } from '@map-colonies/js-logger';
import { DependencyContainer } from 'tsyringe';
import * as k8s from '@kubernetes/client-node';
import { IConfig } from 'config';
import { SERVICES } from '../common/constants';
import { DbConfig } from '../queue/pgbossFactory';
import { K8sJob } from './job';
import { PodConfig, K8sConfig } from './interfaces';
import { createJobSpec } from './utils';
import { JOB_LABELS_SYMBOL } from './constants';

export type JobFactory = (queueName: string, jobConfig: PodConfig) => K8sJob;

export const jobFactoryForDi = (container: DependencyContainer): JobFactory => {
  const config = container.resolve<IConfig>(SERVICES.CONFIG);
  const dbConfig = config.get<DbConfig>('db');
  const instanceUid = config.get<string>('app.instanceUid');
  const k8sConfig = config.get<K8sConfig>('kubernetes');
  const kubeConfig = container.resolve<k8s.KubeConfig>(SERVICES.K8S_CONFIG);
  const logger = container.resolve<Logger>(SERVICES.LOGGER);
  const k8sApi = container.resolve<k8s.CoreV1Api>(SERVICES.K8S_API);
  const k8sJobApi = container.resolve<k8s.BatchV1Api>(SERVICES.K8S_JOB_API);
  const jobInformer = container.resolve<k8s.Informer<k8s.V1Job>>(SERVICES.K8S_JOB_INFORMER);
  const labels = container.resolve<Record<string, string>>(JOB_LABELS_SYMBOL);

  return (queueName: string, podConfig: PodConfig): K8sJob => {
    const jobSpec: k8s.V1Job = createJobSpec(instanceUid, queueName, podConfig, dbConfig, labels, k8sConfig);
    return new K8sJob(kubeConfig, k8sApi, k8sJobApi, jobInformer, jobSpec, k8sConfig.namespace, queueName, logger);
  };
};
