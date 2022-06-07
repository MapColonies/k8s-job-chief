import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { StatesController } from '../controllers/statesController';

export const statesRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(StatesController);

  router.get('/', controller.getStates);

  return router;
};

export const STATES_ROUTER_SYMBOL = Symbol('statesRouterFactory');
