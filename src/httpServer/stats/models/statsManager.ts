import { inject, injectable } from 'tsyringe';
import { QueueProvider, QueueStat, QUEUE_PROVIDER_SYMBOL } from '../../../queue/queueProvider';

@injectable()
export class StatsManager {
  public constructor(
    @inject(QUEUE_PROVIDER_SYMBOL) private readonly queueProvider: QueueProvider
  ) {}
  public async getStats(): Promise<Record<string, QueueStat>> {
    return this.queueProvider.getQueuesStats();
  }
}
