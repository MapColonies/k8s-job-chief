import { TypedEmitter } from 'tiny-typed-emitter';
import * as k8s from '@kubernetes/client-node';
import httpStatus from 'http-status-codes';

interface JobEvents {
  completed: () => void;
  failed: (reason?: string) => void;
  error: (reason: string, message?: string) => void;
}

export class Job extends TypedEmitter<JobEvents> {
  private podInformer: k8s.Informer<k8s.V1Pod> | undefined;
  private name: string | undefined;
  private initTimeout: NodeJS.Timeout | undefined;

  public constructor(
    private readonly kubeConfig: k8s.KubeConfig,
    private readonly k8sApi: k8s.CoreV1Api,
    private readonly k8sJobApi: k8s.BatchV1Api,
    private readonly jobInformer: k8s.Informer<k8s.V1Job>,
    private readonly jobSpec: k8s.V1Job,
    private readonly namespace: string,
    private readonly initTimeoutMs: number
  ) {
    super();
    this.jobInformer.on('update', this.handleJobInformerUpdateEvent);
  }

  public async startJob(): Promise<string> {
    if (this.name !== undefined) {
      throw new Error('job already started');
    }

    const res = await this.k8sJobApi.createNamespacedJob(this.namespace, this.jobSpec);

    if (res.response.statusCode !== httpStatus.CREATED) {
      throw new Error('failed creating job');
    }
    this.name = res.body.metadata?.name;

    this.podInformer = k8s.makeInformer(this.kubeConfig, `/api/v1/namespaces/${this.namespace}/pods`, async () =>
      this.k8sApi.listNamespacedPod(this.namespace, undefined, undefined, undefined, undefined, 'job-name=' + (this.name as string))
    );

    this.initTimeout = setTimeout(() => {
      this.emit('error', 'timeout');
    }, this.initTimeoutMs);

    this.podInformer.on('update', this.handlePodInformerUpdateEvent);
    await this.podInformer.start();

    return res.body.metadata?.uid as string;
  }

  public async deleteJob(): Promise<void> {
    if (this.name === undefined) {
      throw new Error('job not started');
    }
    const res = await this.k8sJobApi.deleteNamespacedJob(this.name, this.namespace, undefined, undefined, undefined, undefined, 'Background');

    if (res.response.statusCode !== httpStatus.OK) {
      throw new Error('failed deleting job');
    }
    if (this.initTimeout !== undefined) {
      clearTimeout(this.initTimeout);
    }

    // this.jobInformer.off('update', this.handleJobInformerUpdateEvent);
    // await this.podInformer?.stop();
  }

  public async shutdown(): Promise<void> {
    this.jobInformer.off('update', this.handleJobInformerUpdateEvent);
    await this.podInformer?.stop();
    if (this.initTimeout !== undefined) {
      clearTimeout(this.initTimeout);
    }
  }

  private readonly handlePodInformerUpdateEvent = (obj: k8s.V1Pod): void => {
    if (obj.status?.phase === 'Pending') {
      const containerState = obj.status.containerStatuses?.[0].state?.waiting;
      if (containerState?.reason === 'CrashLoopBackOff' || (containerState?.reason?.startsWith('Err') ?? false)) {
        this.emit('error', containerState?.reason ?? 'unknown', containerState?.message ?? 'unknown');
      }
      return;
    }
    if (this.initTimeout !== undefined && obj.status?.phase === 'Running') {
      clearTimeout(this.initTimeout);
      this.initTimeout = undefined;
    }
  };

  private readonly handleJobInformerUpdateEvent = (obj: k8s.V1Job): void => {
    const name = obj.metadata?.name;
    if (this.name === undefined || this.name !== name) {
      return;
    }

    if (obj.status?.conditions?.[0]?.type === 'Complete' && obj.status.conditions[0]?.status === 'True') {
      this.emit('completed');
      this.jobInformer.off('update', this.handleJobInformerUpdateEvent);
    } else if (obj.status?.conditions?.[0]?.type === 'Failed' && obj.status.conditions[0]?.status === 'True') {
      this.emit('failed', obj.status.conditions[0]?.reason);
      this.jobInformer.off('update', this.handleJobInformerUpdateEvent);
    }
  };
}
