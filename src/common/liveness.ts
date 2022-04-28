import { FactoryFunction } from 'tsyringe';

const stubHealthcheck = async (): Promise<void> => Promise.resolve();

export const livenessProbeFactory: FactoryFunction<void> = () => {
  return stubHealthcheck;
};
