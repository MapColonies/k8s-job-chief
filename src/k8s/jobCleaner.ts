import { Logger } from '@map-colonies/js-logger';
import { differenceInMilliseconds } from 'date-fns';
import * as k8s from '@kubernetes/client-node';
import { inject, injectable } from 'tsyringe';
import ms from 'ms';
import { SERVICES } from '../common/constants';
import { IConfig } from '../common/interfaces';
import { flattenLabels } from './utils';
import { JOB_LABELS_SYMBOL } from './constants';

@injectable()
export class K8sJobCleaner {
  private readonly namespace: string;
  private readonly cleanupMaxAge: number;
  private readonly labels: string;

  public constructor(
    @inject(SERVICES.K8S_JOB_API) private readonly k8sJobApi: k8s.BatchV1Api,
    @inject(SERVICES.CONFIG) config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(JOB_LABELS_SYMBOL) jobLabels: Record<string, string>
  ) {
    this.namespace = config.get<string>('kubernetes.namespace');
    this.cleanupMaxAge = ms(config.get<string>('kubernetes.jobMaxAgeForDeletion'));
    this.labels = flattenLabels(jobLabels);

    this.logger.info({ msg: 'initialized k8s job cleaner', namespace: this.namespace, cleanupMaxAge: this.cleanupMaxAge, jobLabels });
  }

  public async clean(): Promise<void> {
    let jobsToDeleteNames: string[] = [];

    try {
      const result = await this.k8sJobApi.listNamespacedJob(this.namespace, undefined, undefined, undefined, undefined, this.labels);

      jobsToDeleteNames = result.body.items.filter(this.jobsFilterForDeletion.bind(this)).map((item) => item.metadata?.name as string);

      this.logger.info({
        msg: 'started job cleanup, deleting jobs',
        namespace: this.namespace,
        jobsCount: jobsToDeleteNames.length,
        jobsToDeleteNames,
      });

      await Promise.all(jobsToDeleteNames.map(async (name) => this.k8sJobApi.deleteNamespacedJob(name, this.namespace)));
    } catch (error) {
      this.logger.error({
        err: error,
        msg: 'failed to delete one or more of the following jobs',
        namespace: this.namespace,
        jobsCount: jobsToDeleteNames.length,
        jobsToDeleteNames,
      });
    }
  }

  private jobsFilterForDeletion(job: k8s.V1Job): boolean {
    return (
      job.status?.conditions?.some(
        (condition) =>
          ['Failed', 'Complete'].includes(condition.type) &&
          condition.status === 'True' &&
          differenceInMilliseconds(Date.now(), condition.lastTransitionTime as Date) > this.cleanupMaxAge
      ) ?? false
    );
  }
}
