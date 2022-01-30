import { readFile } from 'fs/promises';
import { Application } from 'express';
import * as k8s from '@kubernetes/client-node';
import { registerExternalValues, RegisterOptions } from './containerConfig';
import { ServerBuilder } from './httpServer/serverBuilder';
import { JobConfig } from './common/interfaces';
import { Job } from './k8s/job';
import { SERVICES } from './common/constants';

async function getApp(registerOptions?: RegisterOptions): Promise<Application> {
  const container = await registerExternalValues(registerOptions);
  const app = container.resolve(ServerBuilder).build();

  const jobRawConfig = JSON.parse(await readFile('jobs.json', 'utf8')) as JobConfig;
  const jobConfig: k8s.V1Job = {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: { generateName: jobRawConfig.queueName + '-', labels: { avi: 'lol' } },
    spec: {
      template: {
        metadata: { name: jobRawConfig.queueName },
        spec: {
          containers: [{ name: 'pi', imagePullPolicy: jobRawConfig.pullPolicy, image: jobRawConfig.image, command: jobRawConfig.command }],
          restartPolicy: 'Never',
        },
      },
      backoffLimit: 0,
    },
  };
  const kc = container.resolve<k8s.KubeConfig>(SERVICES.K8S_CONFIG);

  const k8sJobApi = container.resolve<k8s.BatchV1Api>(SERVICES.K8S_JOB_API);
  const jobInformer = k8s.makeInformer(kc, '/apis/batch/v1/namespaces/default/jobs', async () => k8sJobApi.listNamespacedJob('default'));
  await jobInformer.start();

  const job = new Job(kc, container.resolve<k8s.CoreV1Api>(SERVICES.K8S_API), k8sJobApi, jobInformer, jobConfig);
  const uid = await job.startJob();

  job.on('completed', () => {
    console.log('job completed', uid);
  });

  job.on('failed', (reason) => {
    console.log('job failed', reason);
  });

  return app;
}

export { getApp };
