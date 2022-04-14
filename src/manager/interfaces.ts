import { PodConfig } from '../k8s/interfaces';

export interface JobConfig {
  queueName: string;
  podConfig: PodConfig;
  queueCheckInterval: string;
  jobStartTimeout: string;
  waitTimeAfterSuccessfulRun: string;
  waitTimeAfterTimeout: string;
  waitTimeAfterError: string;
  waitTimeAfterFailedRun: string;
}
