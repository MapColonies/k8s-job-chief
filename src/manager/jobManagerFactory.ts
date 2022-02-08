import { Logger } from '@map-colonies/js-logger';
import { DependencyContainer } from 'tsyringe';
import { SERVICES } from '../common/constants';
import { JobFactory } from '../k8s/jobFactory';
import { QueueProvider, QUEUE_PROVIDER_SYMBOL } from '../queue/queueProvider';
import { JobConfig } from './interfaces';
import { JobManager } from './jobManager';

export type JobManagerFactory = (jobConfig: JobConfig) => JobManager;

export function jobManagerFactoryForDi(container: DependencyContainer): JobManagerFactory {
  const jobFactory = container.resolve<JobFactory>(SERVICES.K8S_JOB_FACTORY);
  const logger = container.resolve<Logger>(SERVICES.LOGGER);
  const provider = container.resolve<QueueProvider>(QUEUE_PROVIDER_SYMBOL);
  return (jobConfig: JobConfig): JobManager => new JobManager(jobConfig, jobFactory, provider, logger);
}
