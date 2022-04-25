import { setInterval as setIntervalIterator } from 'timers/promises';
import { Application } from 'express';
import { IConfig } from 'config';
import ms from 'ms';
import { registerExternalValues, RegisterOptions } from './containerConfig';
import { ServerBuilder } from './httpServer/serverBuilder';
import { ShutdownHandler } from './common/shutdownHandler';
import { K8sJobCleaner } from './k8s/jobCleaner';
import { JobsManager } from './manager/jobsManager';
import { SERVICES } from './common/constants';

export async function getApp(registerOptions?: RegisterOptions): Promise<Application> {
  const container = await registerExternalValues(registerOptions);
  const config = container.resolve<IConfig>(SERVICES.CONFIG);
  const jobCleaner = container.resolve(K8sJobCleaner);

  // rest api
  const app = container.resolve(ServerBuilder).build();
  const clean = async (): Promise<void> => {
    for await (const iterator of setIntervalIterator(ms(config.get<string>('kubernetes.jobCleanupInterval')), undefined, { ref: false })) {
      await jobCleaner.clean();
    }
  };

  void clean();

  // k8s manager
  const manager = container.resolve(JobsManager);
  const shutdownHandler = container.resolve(ShutdownHandler);
  shutdownHandler.addFunction(manager.stop.bind(manager));
  await manager.start();

  return app;
}
