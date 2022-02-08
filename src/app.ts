import { Application } from 'express';
import { registerExternalValues, RegisterOptions } from './containerConfig';
import { ServerBuilder } from './httpServer/serverBuilder';
import { SERVICES } from './common/constants';
import { JobConfig } from './manager/interfaces';
import { JOBS_CONFIG_SYMBOL } from './manager/constants';
import { JobManagerFactory } from './manager/jobManagerFactory';
import { ShutdownHandler } from './common/shutdownHandler';

async function getApp(registerOptions?: RegisterOptions): Promise<Application> {
  const container = await registerExternalValues(registerOptions);
  const app = container.resolve(ServerBuilder).build();
  const shutdownHandler = container.resolve(ShutdownHandler);
  const jobsConfig = container.resolve<JobConfig[]>(JOBS_CONFIG_SYMBOL);
  const jobManagerFactory = container.resolve<JobManagerFactory>(SERVICES.JOB_MANAGER_FACTORY);

  jobsConfig.forEach((jobConfig) => {
    const createJob = jobManagerFactory(jobConfig);
    createJob.start();
    shutdownHandler.addFunction(createJob.stop.bind(createJob));
  });

  return app;
}

export { getApp };
