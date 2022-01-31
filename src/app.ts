import { readFile } from 'fs/promises';
import { Application } from 'express';
import * as k8s from '@kubernetes/client-node';
import { registerExternalValues, RegisterOptions } from './containerConfig';
import { ServerBuilder } from './httpServer/serverBuilder';
import { JobConfig } from './k8s/interfaces';
import { SERVICES } from './common/constants';
import { JobFactory } from './k8s/jobFactory';

async function getApp(registerOptions?: RegisterOptions): Promise<Application> {
  const container = await registerExternalValues(registerOptions);
  const app = container.resolve(ServerBuilder).build();

  const jobRawConfig = JSON.parse(await readFile('jobs.json', 'utf8')) as JobConfig;

  const jobInformer = container.resolve<k8s.Informer<k8s.V1Job>>(SERVICES.K8S_JOB_INFORMER);

  const jobFactory = container.resolve<JobFactory>(SERVICES.K8S_JOB_FACTORY);
  const job = jobFactory(jobRawConfig, 60000);
  const name = await job.startJob();

  job.on('completed', () => {
    console.log('job completed', name);
  });

  job.on('failed', (reason) => {
    console.log('job failed', reason);
  });

  job.on('error', (reason) => {
    console.log('job error', reason);
  });

  return app;
}

export { getApp };
