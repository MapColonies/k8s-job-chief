import { Application } from 'express';
import { registerExternalValues, RegisterOptions } from './containerConfig';
import { ServerBuilder } from './httpServer/serverBuilder';
import { ShutdownHandler } from './common/shutdownHandler';
import { JobsManager } from './manager/jobsManager';

export async function getApp(registerOptions?: RegisterOptions): Promise<Application> {
  const container = await registerExternalValues(registerOptions);

  // rest api
  const app = container.resolve(ServerBuilder).build();

  // k8s manager
  const manager = container.resolve(JobsManager);
  const shutdownHandler = container.resolve(ShutdownHandler);
  shutdownHandler.addFunction(manager.stop.bind(manager));
  await manager.start();

  return app;
}
