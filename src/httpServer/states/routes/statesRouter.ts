import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { StatesController } from '../controllers/statesController';

const statesRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(StatesController);

  router.get('/', controller.getResource);

  return router;
};

export const STATES_ROUTER_SYMBOL = Symbol('statesRouterFactory');

export { statesRouterFactory as statsRouterFactory };
