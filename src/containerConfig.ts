import { readFile } from 'fs/promises';
import config from 'config';
import { logMethod } from '@map-colonies/telemetry';
import { trace } from '@opentelemetry/api';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import jsLogger, { LoggerOptions } from '@map-colonies/js-logger';
import { Metrics } from '@map-colonies/telemetry';
import PgBoss from 'pg-boss';
import { instancePerContainerCachingFactory, Lifecycle } from 'tsyringe';
import { SERVICES, SERVICE_NAME } from './common/constants';
import { tracing } from './common/tracing';
import { statsRouterFactory, STATES_ROUTER_SYMBOL } from './httpServer/states/routes/statesRouter';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { DbConfig, pgBossFactory } from './queue/pgbossFactory';
import { JOB_LABELS_SYMBOL } from './k8s/constants';
import { createJobInformer, createK8sApis } from './k8s/utils';
import { jobFactoryForDi } from './k8s/jobFactory';
import { validateJobConfig } from './manager/schemas';
import { JOBS_CONFIG_SYMBOL } from './manager/constants';
import { QueueProvider } from './queue/queueProvider';
import { PgBossQueueProvider } from './queue/pgbossQueueProvider';
import { JobConfig } from './manager/interfaces';
import { ShutdownHandler } from './common/shutdownHandler';
import { jobLifecycleWrapperFactoryForDi } from './manager/jobLifecycleWrapperFactory';
import { QUEUE_PROVIDER_SYMBOL } from './queue/constants';
import { PgBossJobScheduler } from './scheduler/pgBossJobScheduler';

function getObservabilityDependencies(shutdownHandler: ShutdownHandler): InjectionObject<unknown>[] {
  const loggerConfig = config.get<LoggerOptions>('telemetry.logger');

  // @ts-expect-error the signature is wrong
  const logger = jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, hooks: { logMethod } });

  const metrics = new Metrics(SERVICE_NAME);
  const meter = metrics.start();
  shutdownHandler.addFunction(metrics.stop.bind(metrics));

  tracing.start();
  const tracer = trace.getTracer(SERVICE_NAME);
  shutdownHandler.addFunction(tracing.stop.bind(tracing));
  return [
    { token: SERVICES.LOGGER, provider: { useValue: logger } },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
    { token: SERVICES.METER, provider: { useValue: meter } },
    { token: SERVICES.METRICS, provider: { useValue: metrics } },
  ];
}

async function getK8sDependencies(shutdownHandler: ShutdownHandler): Promise<InjectionObject<unknown>[]> {
  const jobLabels: Record<string, string> = {
    app: 'job-chief',
    'owner-id': config.get('app.instanceUid'),
    environment: process.env.NODE_ENV ?? 'development',
  };

  const [kubeConfig, k8sApi, k8sJobApi] = createK8sApis(config.get<boolean>('kubernetes.loadConfigFromCluster'));

  const jobInformer = createJobInformer(kubeConfig, k8sJobApi, config.get<string>('kubernetes.namespace'), jobLabels);

  await jobInformer.start();
  shutdownHandler.addFunction(jobInformer.stop.bind(jobInformer));

  return [
    { token: JOB_LABELS_SYMBOL, provider: { useValue: jobLabels } },
    { token: SERVICES.K8S_CONFIG, provider: { useValue: kubeConfig } },
    { token: SERVICES.K8S_API, provider: { useValue: k8sApi } },
    { token: SERVICES.K8S_JOB_API, provider: { useValue: k8sJobApi } },
    { token: SERVICES.K8S_JOB_INFORMER, provider: { useValue: jobInformer } },
    { token: SERVICES.K8S_JOB_FACTORY, provider: { useFactory: instancePerContainerCachingFactory(jobFactoryForDi) } },
  ];
}

async function getJobsConfig(): Promise<JobConfig[]> {
  const jobsConfigRaw = await readFile(config.get('app.jobsConfigPath'), 'utf8');
  const jobsConfig = validateJobConfig(JSON.parse(jobsConfigRaw));
  return jobsConfig;
}

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = async (options?: RegisterOptions): Promise<DependencyContainer> => {
  const shutdownHandler = new ShutdownHandler();
  try {
    const jobsConfig = await getJobsConfig();
    const dbConfig = config.get<DbConfig>('db');
    const pgBoss = await pgBossFactory(dbConfig);
    const managerPgBoss = await pgBossFactory({ ...dbConfig, schema: dbConfig.managerSchema });

    const k8sDeps = await getK8sDependencies(shutdownHandler);
    const obsDeps = getObservabilityDependencies(shutdownHandler);

    const dependencies: InjectionObject<unknown>[] = [
      { token: ShutdownHandler, provider: { useValue: shutdownHandler } },
      { token: SERVICES.CONFIG, provider: { useValue: config } },
      ...obsDeps,
      ...k8sDeps,
      { token: JOBS_CONFIG_SYMBOL, provider: { useValue: jobsConfig } },
      { token: PgBoss, provider: { useValue: pgBoss } },
      {
        token: SERVICES.MANAGER_PGBOSS,
        provider: { useValue: managerPgBoss },
        postInjectionHook: async (container): Promise<void> => {
          const boss = container.resolve<PgBoss>(SERVICES.MANAGER_PGBOSS);
          await boss.start();
          shutdownHandler.addFunction(boss.stop.bind(boss));
        },
      },
      { token: SERVICES.JOB_SCHEDULER, provider: { useClass: PgBossJobScheduler } },
      {
        token: SERVICES.JOB_LIFECYCLE_WRAPPER_FACTORY,
        provider: { useFactory: instancePerContainerCachingFactory(jobLifecycleWrapperFactoryForDi) },
      },
      {
        token: QUEUE_PROVIDER_SYMBOL,
        provider: { useClass: PgBossQueueProvider },
        options: { lifecycle: Lifecycle.Singleton },
        postInjectionHook: async (deps: DependencyContainer): Promise<void> => {
          const provider = deps.resolve<QueueProvider>(QUEUE_PROVIDER_SYMBOL);
          shutdownHandler.addFunction(provider.stopQueue.bind(provider));
          await provider.startQueue();
        },
      },
      { token: STATES_ROUTER_SYMBOL, provider: { useFactory: statsRouterFactory } },
    ];

    const container = await registerDependencies(dependencies, options?.override, options?.useChild);
    return container;
  } catch (error) {
    await shutdownHandler.onShutdown();
    throw error;
  }
};
