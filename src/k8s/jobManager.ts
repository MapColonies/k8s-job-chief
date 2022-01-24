import { TypedEmitter } from 'tiny-typed-emitter';
import * as k8s from '@kubernetes/client-node';
import { IConfig } from 'config';
import httpStatus from 'http-status-codes';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../common/constants';

interface JobManagerEvents {
  completed: (uid: string) => void;
  failed: (uid: string) => void;
  failedToStart: (uid: string, reason: string) => void;
}

@injectable()
export class JobManager extends TypedEmitter<JobManagerEvents> {
  private readonly kc: k8s.KubeConfig;
  private readonly k8sApi: k8s.CoreV1Api;
  private readonly k8sJobApi: k8s.BatchV1Api;

  public constructor(@inject(SERVICES.config) private readonly logger: IConfig) {
    super();
    this.kc = new k8s.KubeConfig();

    this.kc.loadFromDefault();

    this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.k8sJobApi = this.kc.makeApiClient(k8s.BatchV1Api);
  }

  public async createJob(job: k8s.V1Job): Promise<string> {
    const res = await this.k8sJobApi.createNamespacedJob('default', job);

    if (res.response.statusCode !== httpStatus.CREATED) {
      throw new Error('failed creating job');
    }

    return res.body.metadata?.uid as string;
  }

  public async deleteJob(uid: string): Promise<void> {
    const res = await this.k8sJobApi.deleteNamespacedJob(uid, 'default', undefined, undefined, undefined, undefined, 'Background');

    if (res.response.statusCode !== httpStatus.OK) {
      throw new Error('failed deleting job');
    }
  }

  public async getJobs(): Promise<k8s.V1JobList> {
    const res = await this.k8sJobApi.listNamespacedJob('default', undefined, undefined, undefined, undefined);

    if (res.response.statusCode !== httpStatus.OK) {
      throw new Error('failed getting jobs');
    }

    return res.body;
  }
}
