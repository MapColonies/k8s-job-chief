import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../../common/constants';
import { QueueProvider, QueueStat, QUEUE_PROVIDER_SYMBOL } from '../../../queue/queueProvider';

@injectable()
export class StatsManager {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(QUEUE_PROVIDER_SYMBOL) private readonly queueProvider: QueueProvider
  ) {}
  public async getStats(): Promise<Record<string, QueueStat>> {
    return this.queueProvider.getQueuesStats();
  }
}
