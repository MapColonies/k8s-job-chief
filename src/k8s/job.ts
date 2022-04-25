import { Logger } from '@map-colonies/js-logger';
import { TypedEmitter } from 'tiny-typed-emitter';
import * as k8s from '@kubernetes/client-node';

function isHttpError(error: unknown): error is k8s.HttpError {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return (error as k8s.HttpError).response !== undefined && (error as k8s.HttpError).body !== undefined;
}

interface JobEvents {
  started: () => Promise<void> | void;
  completed: () => Promise<void> | void;
  failed: (reason?: string) => Promise<void> | void;
  error: (reason: string, message?: string) => Promise<void> | void;
}

export class K8sJob extends TypedEmitter<JobEvents> {
  private podInformer: k8s.Informer<k8s.V1Pod> | undefined;
  private name: string | undefined;
  private emittedStarted = false;
  private deleted = false;

  public constructor(
    private readonly kubeConfig: k8s.KubeConfig,
    private readonly k8sApi: k8s.CoreV1Api,
    private readonly k8sJobApi: k8s.BatchV1Api,
    private readonly jobInformer: k8s.Informer<k8s.V1Job>,
    private readonly jobSpec: k8s.V1Job,
    private readonly namespace: string,
    public readonly queueName: string,
    public readonly logger: Logger
  ) {
    super();
    this.jobInformer.on('update', this.handleJobInformerUpdateEvent);
    this.jobInformer.on('delete', this.handleJobInformerDeleteEvent);
  }

  public async startJob(): Promise<string> {
    if (this.name !== undefined) {
      throw new Error('job already started');
    }
    let res: Awaited<ReturnType<typeof this.k8sJobApi.createNamespacedJob>>;
    try {
      res = await this.k8sJobApi.createNamespacedJob(this.namespace, this.jobSpec);
    } catch (error) {
      if (isHttpError(error)) {
        this.logger.debug(error.body, `createNamespacedJob request for queue ${this.queueName} failed`);
      }
      throw error;
    }

    this.name = res.body.metadata?.name;

    this.podInformer = k8s.makeInformer(
      this.kubeConfig,
      `/api/v1/namespaces/${this.namespace}/pods`,
      async () => this.k8sApi.listNamespacedPod(this.namespace, undefined, undefined, undefined, undefined, 'job-name=' + (this.name as string)),
      'job-name=' + (this.name as string)
    );

    this.podInformer.on('update', this.handlePodInformerUpdateEvent);
    await this.podInformer.start();

    return res.body.metadata?.name as string;
  }

  public async deleteJob(): Promise<void> {
    if (this.name === undefined) {
      throw new Error('job not started');
    }
    this.deleted = true;
    try {
      await this.k8sJobApi.deleteNamespacedJob(this.name, this.namespace, undefined, undefined, undefined, undefined, 'Background');
    } catch (error) {
      this.deleted = false;
      if (isHttpError(error)) {
        this.logger.debug(error.body, `deleteNamespacedJob request for queue ${this.queueName} failed`);
      }
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    this.jobInformer.off('update', this.handleJobInformerUpdateEvent);
    await this.podInformer?.stop();
  }

  private readonly handlePodInformerUpdateEvent = (obj: k8s.V1Pod): void => {
    if (obj.status?.phase === 'Pending') {
      const containerState = obj.status.containerStatuses?.[0].state?.waiting;
      if (containerState?.reason === 'CrashLoopBackOff' || (containerState?.reason?.startsWith('Err') ?? false)) {
        this.emit('error', containerState?.reason ?? 'unknown', containerState?.message ?? 'unknown');
      }
      return;
    }
    if (!this.emittedStarted && obj.status?.phase === 'Running') {
      this.emit('started');
      this.emittedStarted = true;
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

  private readonly handleJobInformerDeleteEvent = (obj: k8s.V1Job): void => {
    if (this.deleted) {
      return;
    }
    if (obj.metadata?.name === this.name) {
      this.emit('failed', 'Job deleted');
      this.jobInformer.off('delete', this.handleJobInformerDeleteEvent);
    }
  };
}
