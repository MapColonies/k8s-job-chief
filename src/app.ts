import { Application } from 'express';
import { registerExternalValues, RegisterOptions } from './containerConfig';
import { ServerBuilder } from './httpServer/serverBuilder';
import { SERVICES } from './common/constants';
import { JobFactory } from './k8s/jobFactory';
import { JobConfig } from './manager/interfaces';
import { JOBS_CONFIG_SYMBOL } from './manager/constants';
import { JobManager } from './manager/jobManager';
import { QueueProvider, QUEUE_PROVIDER_SYMBOL } from './queue/queueProvider';

async function getApp(registerOptions?: RegisterOptions): Promise<Application> {
  const container = await registerExternalValues(registerOptions);
  const app = container.resolve(ServerBuilder).build();

  const jobsConfig = container.resolve<JobConfig[]>(JOBS_CONFIG_SYMBOL);

  const jobFactory = container.resolve<JobFactory>(SERVICES.K8S_JOB_FACTORY);
  const queueProviderr = container.resolve<QueueProvider>(QUEUE_PROVIDER_SYMBOL);
  await queueProviderr.startQueue();

  jobsConfig.forEach((jobConfig) => {
    const createJob = new JobManager(jobConfig, jobFactory, queueProviderr, container.resolve(SERVICES.LOGGER));
    createJob.startJob();
  });

  return app;
}

export { getApp };
