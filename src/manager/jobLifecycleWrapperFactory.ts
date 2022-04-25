import { Logger } from '@map-colonies/js-logger';
import { DependencyContainer } from 'tsyringe';
import { SERVICES } from '../common/constants';
import { JobFactory } from '../k8s/jobFactory';
import { QUEUE_PROVIDER_SYMBOL } from '../queue/constants';
import { QueueProvider } from '../queue/queueProvider';
import { JobScheduler } from '../scheduler/jobScheduler';
import { JobConfig } from './interfaces';
import { JobLifecycleWrapper } from './jobLifecycleWrapper';

export type JobLifecycleWrapperFactory = (jobConfig: JobConfig) => JobLifecycleWrapper;

export function jobLifecycleWrapperFactoryForDi(container: DependencyContainer): JobLifecycleWrapperFactory {
  const jobFactory = container.resolve<JobFactory>(SERVICES.K8S_JOB_FACTORY);
  const logger = container.resolve<Logger>(SERVICES.LOGGER);
  const provider = container.resolve<QueueProvider>(QUEUE_PROVIDER_SYMBOL);
  const scheduler = container.resolve<JobScheduler>(SERVICES.JOB_SCHEDULER);
  return (jobConfig: JobConfig): JobLifecycleWrapper => new JobLifecycleWrapper(jobConfig, jobFactory, provider, scheduler, logger);
}
