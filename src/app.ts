import { readFile } from 'fs/promises';
import { Application } from 'express';
import { registerExternalValues, RegisterOptions } from './containerConfig';
import { ServerBuilder } from './httpServer/serverBuilder';
import { JobConfig } from './common/interfaces';
import { JobManager } from './k8s/jobManager';

async function getApp(registerOptions?: RegisterOptions): Promise<Application> {
  const container = await registerExternalValues(registerOptions);
  const app = container.resolve(ServerBuilder).build();

  const job = JSON.parse(await readFile('jobs.json', 'utf8')) as JobConfig;

  const manager = container.resolve(JobManager);
  await manager.start();
  try {
    const uid = await manager.createJob({
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: { name: job.queueName },
      spec: {
        template: {
          metadata: { name: job.queueName },
          spec: { containers: [{ name: 'pi', imagePullPolicy: job.pullPolicy, image: job.image, command: job.command }], restartPolicy: 'Never' },
        },
        backoffLimit: 0,
      },
    });
  } catch (error) {
    console.log(error);
  }

  manager.on('completed', (uid) => {
    console.log('job completed', uid);
  });

  return app;
}

export { getApp };
