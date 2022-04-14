import { inject, injectable } from 'tsyringe';
import { QUEUE_PROVIDER_SYMBOL } from '../../../queue/constants';
import { QueueStat } from '../../../queue/interfaces';
import { QueueProvider } from '../../../queue/queueProvider';

@injectable()
export class StatesManager {
  public constructor(@inject(QUEUE_PROVIDER_SYMBOL) private readonly queueProvider: QueueProvider) {}
  public async getStates(): Promise<Record<string, QueueStat>> {
    return this.queueProvider.getQueuesStates();
  }
}
