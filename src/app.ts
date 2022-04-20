import { setInterval as setIntervalIterator } from 'timers/promises';
import { Application } from 'express';
import { IConfig } from 'config';
import ms from 'ms';
import { registerExternalValues, RegisterOptions } from './containerConfig';
import { ServerBuilder } from './httpServer/serverBuilder';
import { SERVICES } from './common/constants';
import { JobConfig } from './manager/interfaces';
import { JOBS_CONFIG_SYMBOL } from './manager/constants';
import { JobManagerFactory } from './manager/jobManagerFactory';
import { ShutdownHandler } from './common/shutdownHandler';
import { K8sJobCleaner } from './k8s/jobCleaner';

async function getApp(registerOptions?: RegisterOptions): Promise<Application> {
  const container = await registerExternalValues(registerOptions);
  const config = container.resolve<IConfig>(SERVICES.CONFIG);
  const jobCleaner = container.resolve(K8sJobCleaner);
  const app = container.resolve(ServerBuilder).build();
  const shutdownHandler = container.resolve(ShutdownHandler);
  const jobsConfig = container.resolve<JobConfig[]>(JOBS_CONFIG_SYMBOL);
  const jobManagerFactory = container.resolve<JobManagerFactory>(SERVICES.JOB_MANAGER_FACTORY);

  const clean = async (): Promise<void> => {
    for await (const iterator of setIntervalIterator(ms(config.get<string>('kubernetes.jobCleanupInterval')), undefined, { ref: false })) {
      await jobCleaner.clean();
    }
  };

  void clean();

  jobsConfig.forEach((jobConfig) => {
    const job = jobManagerFactory(jobConfig);
    job.start();
    shutdownHandler.addFunction(job.stop.bind(job));
  });

  return app;
}

export { getApp };
