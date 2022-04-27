import { createServer } from 'http';
import { createTerminus } from '@godaddy/terminus';
import { FactoryFunction } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { ServerBuilder } from '../httpServer/serverBuilder';
import { ShutdownHandler } from './shutdownHandler';
import { IConfig, IServerConfig } from './interfaces';
import { DEFAULT_SERVER_PORT, SERVICES } from './constants';

const stubHealthcheck = async (): Promise<void> => Promise.resolve();

export const livenessProbeFactory: FactoryFunction<void> = (container) => {
  const config = container.resolve<IConfig>(SERVICES.CONFIG);
  const serverConfig = config.get<IServerConfig>('server');
  const port: number = parseInt(serverConfig.port) || DEFAULT_SERVER_PORT;

  const shutdownHandler = container.resolve(ShutdownHandler);

  const app = container.resolve(ServerBuilder).build();
  const server = createTerminus(createServer(app), {
    healthChecks: { '/liveness': stubHealthcheck },
    onSignal: shutdownHandler.onShutdown.bind(shutdownHandler),
  });

  shutdownHandler.addFunction(async () => {
    return new Promise((resolve) => {
      server.once('close', resolve);
      server.close();
    });
  });

  server.listen(port, () => {
    const logger = container.resolve<Logger>(SERVICES.LOGGER);
    logger.info(`app started on port ${port}`);
  });
};
