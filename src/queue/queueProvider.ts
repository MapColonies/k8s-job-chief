import { QueueStat } from './interfaces';

export interface QueueProvider {
  isQueueEmpty: (name: string) => Promise<boolean>;
  startQueue: () => Promise<void>;
  stopQueue: () => Promise<void>;
  getQueuesStates: () => Promise<Record<string, QueueStat>>;
}
