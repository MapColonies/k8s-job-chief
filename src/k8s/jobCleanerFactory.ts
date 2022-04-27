import { setInterval as setIntervalIterator } from 'timers/promises';
import { IConfig } from 'config';
import ms from 'ms';
import { FactoryFunction } from 'tsyringe';
import { SERVICES } from '../common/constants';
import { K8sJobCleaner } from './jobCleaner';

export const jobCleanerFactory: FactoryFunction<() => Promise<void>> = (container) => {
  const config = container.resolve<IConfig>(SERVICES.CONFIG);
  const jobCleaner = container.resolve(K8sJobCleaner);

  // rest api
  const clean = async (): Promise<void> => {
    for await (const iterator of setIntervalIterator(ms(config.get<string>('kubernetes.jobCleanupInterval')), undefined, { ref: false })) {
      await jobCleaner.clean();
    }
  };

  return clean;
}
