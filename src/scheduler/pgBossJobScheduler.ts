import { setInterval as setIntervalPromise } from 'timers/promises';
import PgBoss from 'pg-boss';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { SERVICES } from '../common/constants';
import { JobScheduler } from './jobScheduler';

const QUEUE_NAME = 'k8s-job-starts';
const WAIT_TIME_MS = 1000;

@injectable()
export class PgBossJobScheduler implements JobScheduler {
  public constructor(@inject(SERVICES.MANAGER_PGBOSS) private readonly pgBoss: PgBoss, @inject(SERVICES.LOGGER) private readonly logger: Logger) {}

  public async scheduleJob(name: string, startAfter?: number): Promise<string | null> {
    this.logger.debug({ msg: 'scheduling job', queueName: QUEUE_NAME, jobName: name, startAfter });

    return this.pgBoss.send(QUEUE_NAME, { name }, { singletonKey: name, startAfter });
  }

  public async handleJobs(handler: (data: { name: string }) => Promise<void>, signal: AbortSignal): Promise<void> {
    for await (const queueName of setIntervalPromise(WAIT_TIME_MS, QUEUE_NAME, { signal })) {
      const job = await this.pgBoss.fetch<{ name: string }>(queueName);
      if (job != null) {
        this.logger.debug({ msg: 'marking job as completed', queueName, jobId: job.id, jobName: job.name });

        await this.pgBoss.complete(job.id);
        await handler(job.data);
      }
    }
  }
}
