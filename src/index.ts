/* eslint-disable import/first */
// this import must be called before the first import of tsyring
import 'reflect-metadata';
import { Logger } from '@map-colonies/js-logger';
import { DependencyContainer } from 'tsyringe';
import { JOB_CLEANER_FACTORY, LIVENESS_PROBE_FACTORY, SERVICES } from './common/constants';
import { ShutdownHandler } from './common/shutdownHandler';
import { registerExternalValues } from './containerConfig';
import { JobsManager } from './manager/jobsManager';

let depContainer: DependencyContainer | undefined;

void registerExternalValues()
  .then(async (container) => {
    depContainer = container;

    container.resolve<void>(LIVENESS_PROBE_FACTORY);

    container.resolve<void>(JOB_CLEANER_FACTORY);

    const manager = container.resolve(JobsManager);
    const shutdownHandler = container.resolve(ShutdownHandler);
    shutdownHandler.addFunction(manager.stop.bind(manager));
    await manager.start();
  }).catch(async (error: Error) => {
    const errorLogger = depContainer?.isRegistered(SERVICES.LOGGER) == true
      ? depContainer.resolve<Logger>(SERVICES.LOGGER).error.bind(depContainer.resolve<Logger>(SERVICES.LOGGER))
      : console.error;
    errorLogger({ msg: '😢 - failed initializing the server', err: error });

    if (depContainer?.isRegistered(ShutdownHandler) == true) {
      const shutdownHandler = depContainer.resolve(ShutdownHandler);
      await shutdownHandler.onShutdown();
    }
  });
