export interface QueueStat {
  created: number;
  retry: number;
  active: number;
  completed: number;
  expired: number;
  cancelled: number;
  failed: number;
  all: number;
}

export const QUEUE_PROVIDER_SYMBOL = Symbol('queueProvider');

export interface QueueProvider {
  isQueueEmpty: (name: string) => Promise<boolean>;
  startQueue: () => Promise<void>;
  stopQueue: () => Promise<void>;
  getQueuesStats: () => Promise<Record<string, QueueStat>>;
}
