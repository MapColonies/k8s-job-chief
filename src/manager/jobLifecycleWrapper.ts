import ms from 'ms';
import { Logger } from '@map-colonies/js-logger';
import { TypedEmitter } from 'tiny-typed-emitter';
import { presult } from '../common/util';
import { K8sJob } from '../k8s/job';
import { JobFactory } from '../k8s/jobFactory';
import { QueueProvider } from '../queue/queueProvider';
import { JobScheduler } from '../scheduler/jobScheduler';
import { JobConfig } from './interfaces';

const SECOND_MS = 1000;

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
    this.logger.info({ msg: 'checking if a new job should start on queue', queueName: this.jobConfig.queueName });

    const [error, isEmpty] = await presult(this.queueProvider.isQueueEmpty(this.jobConfig.queueName));

    // checking if an error occurred while checking queue status
    if (error) {
      this.logger.error({ err: error, msg: 'failed to check if queue is empty', queueName: this.jobConfig.queueName });
      throw error;
    }

    if (isEmpty) {
      this.logger.info({
        msg: 'queue is empty, will check again shortly',
        queueCheckInterval: this.jobConfig.queueCheckInterval,
        queueName: this.jobConfig.queueName,
      });
      return this.scheduleNextRun(ms(this.jobConfig.queueCheckInterval));
    }

    this.logger.debug({ msg: 'attempting to spawn a new job', queueName: this.jobConfig.queueName });
    this.currentJob = this.jobFactory(this.jobConfig.queueName, this.jobConfig.podConfig);

    this.startTimeout = setTimeout(this.handleJobStartTimeout, ms(this.jobConfig.jobStartTimeout));

    this.currentJob.once('completed', this.handleJobCompletion);
    this.currentJob.once('error', this.handleJobError);
    this.currentJob.once('failed', this.handleJobFailed);
    this.currentJob.once('started', this.handleJobStarted);

    const [err, jobName] = await presult(this.currentJob.startJob());
    if (err) {
      this.logger.error({ err, msg: 'job failed to start', queueName: this.jobConfig.queueName, jobName });
      return this.scheduleNextRun(ms(this.jobConfig.waitTimeAfterError));
    }

    this.jobName = jobName ? jobName : '';
    this.logger.debug({ msg: 'spawned new job', queueName: this.jobConfig.queueName, jobName });
  }

  public async stop(): Promise<void> {
    this.logger.debug({ msg: 'stopping queue', queueName: this.jobConfig.queueName });
    await this.cleanUp();
  }

  private readonly handleJobCompletion = async (): Promise<void> => {
    this.logger.info({ msg: 'job completed', jobName: this.jobName });
    // const job = this.currentJob as K8sJob;
    // void job.deleteJob().then(async () => this.scheduleNextRun(ms(this.jobConfig.waitTimeAfterSuccessfulRun)));
    await this.scheduleNextRun(ms(this.jobConfig.waitTimeAfterSuccessfulRun));
  };

  private readonly handleJobError = async (reason: string, message?: string): Promise<void> => {
    this.logger.error({ msg: 'job had an error', jobName: this.jobName, reason, message });
    await this.scheduleNextRun(ms(this.jobConfig.waitTimeAfterError));
  };

  private readonly handleJobFailed = async (reason?: string): Promise<void> => {
    this.logger.error({ msg: 'job failed', jobName: this.jobName, reason: `${reason ?? 'unknown'}` });
    await this.scheduleNextRun(ms(this.jobConfig.waitTimeAfterFailedRun));
  };

  private readonly handleJobStarted = (): void => {
    if (this.startTimeout) {
      this.logger.debug({ msg: 'starting job by clearing its start timeout', jobName: this.jobName });
      clearTimeout(this.startTimeout);
    }
  };

  private readonly handleJobStartTimeout = (): void => {
    this.logger.error({
      msg: 'job failed to start after start timeout, will try again shortly',
      startTimeout: this.jobConfig.jobStartTimeout,
      jobName: this.jobName,
      waitTimeAfterTimeout: this.jobConfig.waitTimeAfterTimeout,
    });
    void this.scheduleNextRun(ms(this.jobConfig.waitTimeAfterTimeout));
  };

  private async scheduleNextRun(timeoutMs: number): Promise<void> {
    if (this.currentJob !== undefined) {
      const [error] = await presult(this.currentJob.shutdown());
      if (error) {
        this.logger.error({ err: error, msg: 'job failed to shutdown', queueName: this.jobConfig.queueName });
      }
    }

    await this.cleanUp();
    this.logger.debug({ msg: 'queue will run again after timeout', queueName: this.jobConfig.queueName, timeout: timeoutMs });
    await this.scheduler.scheduleJob(this.jobConfig.queueName, timeoutMs / SECOND_MS);
  }

  private async cleanUp(): Promise<void> {
    this.logger.debug({ msg: 'cleaning up queue', queueName: this.jobConfig.queueName });

    this.currentJob?.removeAllListeners();
    await this.currentJob?.shutdown();
    if (this.startTimeout) {
      this.logger.debug({ msg: 'clearing queue start timeout', queueName: this.jobConfig.queueName });
      clearTimeout(this.startTimeout);
    }
    this.currentJob = undefined;
    this.emit('completed');
  }
}
