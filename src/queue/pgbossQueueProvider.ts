import { Logger } from '@map-colonies/js-logger';
import PgBoss from 'pg-boss';
import { inject, singleton } from 'tsyringe';
import { SERVICES } from '../common/constants';
import { JOBS_CONFIG_SYMBOL } from '../manager/constants';
import { JobConfig } from '../manager/interfaces';
import { QueueProvider, QueueStat } from './queueProvider';

@singleton()
export class PgBossQueueProvider implements QueueProvider {
  private readonly queuesNames: Set<string>;
  private states: Record<string, QueueStat> = {};
  public constructor(
    private readonly pgBoss: PgBoss,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(JOBS_CONFIG_SYMBOL) jobsConfig: JobConfig[]
  ) {
    this.queuesNames = new Set(jobsConfig.map((jobConfig) => jobConfig.queueName));
  }

  public async startQueue(): Promise<void> {
    this.logger.info('starting pg-boss queue');
    this.pgBoss.on('monitor-states', (states) => {
      this.states = Object.entries(states.queues).reduce((acc, [name, stats]) => {
        if (this.queuesNames.has(name)) {
          acc[name] = stats;
        }
        return acc;
      }, {} as Record<string, QueueStat>);
    });
    await this.pgBoss.start();
  }

  public async stopQueue(): Promise<void> {
    this.logger.info('stopping pg-boss queue');
    await this.pgBoss.stop();
  }

  public async getQueuesStats(): Promise<Record<string, QueueStat>> {
    return Promise.resolve(this.states);
  }

  public async isQueueEmpty (name: string): Promise<boolean> {
    const count = await this.pgBoss.getQueueSize(name);
    return count === 0;
  }
}
