import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { JobScheduler } from '../scheduler/jobScheduler';
import { SERVICES } from '../common/constants';
import { JobConfig } from './interfaces';
import { JobLifecycleWrapperFactory } from './jobLifecycleWrapperFactory';
import { JOBS_CONFIG_SYMBOL } from './constants';
import { JobLifecycleWrapper } from './jobLifecycleWrapper';

interface JobObject {
  config: JobConfig;
  lifecycleWrapper?: JobLifecycleWrapper;
}

@injectable()
export class JobsManager {
  private readonly abortController = new AbortController();
  private readonly jobMap = new Map<string, JobObject>();

  public constructor(
    @inject(SERVICES.JOB_SCHEDULER) private readonly scheduler: JobScheduler,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.JOB_LIFECYCLE_WRAPPER_FACTORY) private readonly jobLifecycleWrapperFactory: JobLifecycleWrapperFactory,
    @inject(JOBS_CONFIG_SYMBOL) jobConfigs: JobConfig[]
  ) {
    this.jobMap = jobConfigs.reduce((prev, curr) => prev.set(curr.queueName, { config: curr }), new Map<string, JobObject>());
    this.logger.info({ msg: 'initiazlied jobs manager with the following config', jobConfigs: jobConfigs, jobsCount: jobConfigs.length });
  }

  public async start(): Promise<void> {
    this.logger.debug({ msg: 'scheduling jobs', count: this.jobMap.keys() });

    // start new jobs
    for await (const key of this.jobMap.keys()) {
      await this.scheduler.scheduleJob(key, 0);
    }

    await this.scheduler.handleJobs(this.jobHandler.bind(this), this.abortController.signal);
  }

  public async stop(): Promise<void> {
    this.logger.debug({ msg: 'stopping jobs' });

    this.abortController.abort();
    await Promise.all(Array.from(this.jobMap.values()).map(({ lifecycleWrapper }) => lifecycleWrapper?.stop()));
  }

  private async jobHandler({ name }: { name: string }): Promise<void> {
    this.logger.debug({ msg: 'handling job', jobName: name });

    try {
      const jobObject = this.jobMap.get(name);

      if (!jobObject) {
        throw new Error(`Job ${name} not found`);
      }

      jobObject.lifecycleWrapper = this.jobLifecycleWrapperFactory(jobObject.config);

      jobObject.lifecycleWrapper.once('completed', () => {
        this.logger.debug({ msg: 'job completed', jobName: name });
        jobObject.lifecycleWrapper = undefined;
      });

      await jobObject.lifecycleWrapper.start();
    } catch (error) {
      this.logger.error({ err: error, jobName: name });
      throw error;
    }
  }
}
