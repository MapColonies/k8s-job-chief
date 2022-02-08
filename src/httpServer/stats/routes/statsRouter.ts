import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { StatsController } from '../controllers/statsController';

const statsRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(StatsController);

  router.get('/', controller.getResource);

  return router;
};

export const STATS_ROUTER_SYMBOL = Symbol('statsRouterFactory');

export { statsRouterFactory };
