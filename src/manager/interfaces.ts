import { PodConfig } from '../k8s/interfaces';

export interface JobConfig {
  queueName: string;
  podConfig: PodConfig;
  queueCheckIntervalMs: number;
  delayAfterInitFailureMs: number;
  delayAfterFailedRunMs: number;
}
