import { Logger } from '@map-colonies/js-logger';
import PgBoss from 'pg-boss';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../common/constants';
import { JOBS_CONFIG_SYMBOL } from '../manager/constants';
import { JobConfig } from '../manager/interfaces';
import { QueueStat } from './interfaces';
import { QueueProvider } from './queueProvider';

@injectable()
export class PgBossQueueProvider implements QueueProvider {
  private readonly jobQueuesNames: Set<string>;
  private states: Record<string, QueueStat> = {};

  public constructor(
    private readonly pgBoss: PgBoss,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(JOBS_CONFIG_SYMBOL) jobsConfig: JobConfig[]
  ) {
    this.jobQueuesNames = new Set(jobsConfig.map((jobConfig) => jobConfig.queueName));
    this.logger.info({ msg: 'initialized pgboss', jobQueuesNames: this.jobQueuesNames });
  }

  public async startQueue(): Promise<void> {
    this.logger.info({ msg: 'starting pgboss queue' });

    this.pgBoss.on('error', (err) => {
      this.logger.error({ err, msg: 'pgboss error occurred' });
    });
    this.pgBoss.on('monitor-states', this.handleMonitorStates);

    await this.pgBoss.start();
  }

  public async stopQueue(): Promise<void> {
    this.logger.info({ msg: 'stopping pgboss queue' });
    await this.pgBoss.stop();
  }

  public async getQueuesStates(): Promise<Record<string, QueueStat>> {
    return Promise.resolve(this.states);
  }

  public async isQueueEmpty(name: string): Promise<boolean> {
    this.logger.debug({ msg: 'getting queue size', queue: name });

    const count = await this.pgBoss.getQueueSize(name);
    return count === 0;
  }

  private readonly handleMonitorStates = (states: PgBoss.MonitorStates): void => {
    const newStates: Record<string, QueueStat> = {};
    const entries = Object.entries(states.queues);

    this.logger.debug({ msg: 'monitoring states', statesCount: entries.length });

    for (const [name, states] of entries) {
      if (this.jobQueuesNames.has(name)) {
        newStates[name] = states;
      }
    }

    this.states = newStates;
  };
}
