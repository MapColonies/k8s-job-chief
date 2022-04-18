import ms from 'ms';
import { Logger } from '@map-colonies/js-logger';
import { TypedEmitter } from 'tiny-typed-emitter';
import { presult } from '../common/util';
import { K8sJob } from '../k8s/job';
import { JobFactory } from '../k8s/jobFactory';
import { QueueProvider } from '../queue/queueProvider';
import { JobScheduler } from '../scheduler/jobScheduler';
import { JobConfig } from './interfaces';

const MILLISECONDS_IN_SECOND = 1000;

interface JobEvents {
  completed: () => Promise<void> | void;
}

export class JobLifecycleWrapper extends TypedEmitter<JobEvents> {
  private currentJob: K8sJob | undefined = undefined;
  private startTimeout: NodeJS.Timeout | undefined = undefined;
  // private scheduleTimeout: NodeJS.Timeout | undefined = undefined;
  private jobName = '';

  public constructor(
    private readonly jobConfig: JobConfig,
    private readonly jobFactory: JobFactory,
    private readonly queueProvider: QueueProvider,
    private readonly scheduler: JobScheduler,
    private readonly logger: Logger
  ) {
    super();
  }

  public async start(): Promise<void> {
    this.logger.info(`checking if should start job on queue ${this.jobConfig.queueName}`);
    const [error, isEmpty] = await presult(this.queueProvider.isQueueEmpty(this.jobConfig.queueName));

    // checking if an error occurred while checking queue status
    if (error) {
      this.logger.error(error, `queue ${this.jobConfig.queueName} failed to check if it is empty`);
      throw error;
    }

    if (isEmpty) {
      this.logger.debug(`queue ${this.jobConfig.queueName} is empty`);
      return this.scheduleNextRun(ms(this.jobConfig.queueCheckInterval));
    }

    this.logger.debug(`queue: ${this.jobConfig.queueName} spawning new job`);
    this.currentJob = this.jobFactory(this.jobConfig.queueName, this.jobConfig.podConfig);

    this.startTimeout = setTimeout(this.handleJobStartTimeout, ms(this.jobConfig.jobStartTimeout));

    this.currentJob.once('completed', this.handleJobCompletion);
    this.currentJob.once('error', this.handleJobError);
    this.currentJob.once('failed', this.handleJobFailed);
    this.currentJob.once('started', this.handleJobStarted);

    const [err, jobName] = await presult(this.currentJob.startJob());
    if (err) {
      this.logger.error(err, `job ${this.jobConfig.queueName} failed to start`);
      return this.scheduleNextRun(ms(this.jobConfig.waitTimeAfterError));
    }

    this.jobName = jobName;
  }

  public async stop(): Promise<void> {
    await this.cleanUp();
  }

  private readonly handleJobCompletion = async (): Promise<void> => {
    this.logger.info(`job ${this.jobName} completed`);
    // const job = this.currentJob as K8sJob;
    // void job.deleteJob().then(async () => this.scheduleNextRun(ms(this.jobConfig.waitTimeAfterSuccessfulRun)));
    await this.scheduleNextRun(ms(this.jobConfig.waitTimeAfterSuccessfulRun));
  };

  private readonly handleJobError = async (reason: string, message?: string): Promise<void> => {
    this.logger.error(`job ${this.jobName} failed with reason ${reason} and message ${message ?? ''}`);
    await this.scheduleNextRun(ms(this.jobConfig.waitTimeAfterError));
  };

  private readonly handleJobFailed = async (reason?: string): Promise<void> => {
    this.logger.error(`job ${this.jobName} failed with reason ${reason ?? 'unknown'}`);
    await this.scheduleNextRun(ms(this.jobConfig.waitTimeAfterFailedRun));
  };

  private readonly handleJobStarted = (): void => {
    if (this.startTimeout) {
      this.logger.debug(`job ${this.jobName} is running - clearing timeout`);
      clearTimeout(this.startTimeout);
    }
  };

  private readonly handleJobStartTimeout = (): void => {
    this.logger.error(`job ${this.jobName} failed to start after ${this.jobConfig.jobStartTimeout}`);
    void this.scheduleNextRun(ms(this.jobConfig.waitTimeAfterTimeout));
  };

  private async scheduleNextRun(timeoutMs: number): Promise<void> {
    if (this.currentJob !== undefined) {
      const [error] = await presult(this.currentJob.shutdown());
      if (error) {
        this.logger.error(error, `job ${this.jobConfig.queueName} failed to shutdown`);
      }
    }

    await this.cleanUp();
    this.logger.debug(`queue ${this.jobConfig.queueName} will run again in ${timeoutMs}ms`);
    await this.scheduler.scheduleJob(this.jobConfig.queueName, timeoutMs / MILLISECONDS_IN_SECOND);
  }

  private async cleanUp(): Promise<void> {
    this.logger.debug(`queue ${this.jobConfig.queueName} cleaning up`);
    this.currentJob?.removeAllListeners();
    await this.currentJob?.shutdown();
    if (this.startTimeout) {
      this.logger.debug(`queue ${this.jobConfig.queueName} clearing start timeout`);
      clearTimeout(this.startTimeout);
    }
    this.currentJob = undefined;
    this.emit('completed');
  }
}