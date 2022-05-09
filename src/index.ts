/* eslint-disable import/first */
// this import must be called before the first import of tsyring
import 'reflect-metadata';
import { createServer } from 'http';
import { Logger } from '@map-colonies/js-logger';
import { createTerminus } from '@godaddy/terminus';
import { DependencyContainer } from 'tsyringe';
import { JOB_CLEANER_FACTORY, LIVENESS_PROBE_FACTORY, DEFAULT_SERVER_PORT, SERVICES } from './common/constants';
import { ShutdownHandler } from './common/shutdownHandler';
import { ServerBuilder } from './httpServer/serverBuilder';
import { registerExternalValues } from './containerConfig';
import { JobsManager } from './manager/jobsManager';
import { IConfig } from './common/interfaces';

let depContainer: DependencyContainer | undefined;

void registerExternalValues()
  .then(async (container) => {
    depContainer = container;

    const livenessCheck = container.resolve<() => Promise<void>>(LIVENESS_PROBE_FACTORY);
    container.resolve<void>(JOB_CLEANER_FACTORY);

    const config = depContainer.resolve<IConfig>(SERVICES.CONFIG);
    const port: number = config.get<number>('server.port') || DEFAULT_SERVER_PORT;
    const app = depContainer.resolve(ServerBuilder).build();
    const shutdownHandler = container.resolve(ShutdownHandler);
    const server = createTerminus(createServer(app), {
      healthChecks: { '/liveness': livenessCheck },
      onSignal: shutdownHandler.onShutdown.bind(shutdownHandler),
    });

    shutdownHandler.addFunction(async () => {
      return new Promise((resolve) => {
        server.once('close', resolve);
        server.close();
      });
    });

    const manager = container.resolve(JobsManager);
    shutdownHandler.addFunction(manager.stop.bind(manager));
    await manager.start();

    server.listen(port, () => {
      const logger = container.resolve<Logger>(SERVICES.LOGGER);
      logger.info(`app started on port ${port}`);
    });
  })
  .catch(async (error: Error) => {
    const errorLogger =
      depContainer?.isRegistered(SERVICES.LOGGER) == true
        ? depContainer.resolve<Logger>(SERVICES.LOGGER).error.bind(depContainer.resolve<Logger>(SERVICES.LOGGER))
        : console.error;
    errorLogger({ msg: '😢 - failed initializing the server', err: error });

    if (depContainer?.isRegistered(ShutdownHandler) == true) {
      const shutdownHandler = depContainer.resolve(ShutdownHandler);
      await shutdownHandler.onShutdown();
    }
  });
