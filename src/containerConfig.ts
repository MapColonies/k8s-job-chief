import config from 'config';
import { logMethod } from '@map-colonies/telemetry';
import { trace } from '@opentelemetry/api';
import * as k8s from '@kubernetes/client-node';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import jsLogger, { LoggerOptions } from '@map-colonies/js-logger';
import { Metrics } from '@map-colonies/telemetry';
import PgBoss from 'pg-boss';
import { SERVICES, SERVICE_NAME } from './common/constants';
import { tracing } from './common/tracing';
import { resourceNameRouterFactory, RESOURCE_NAME_ROUTER_SYMBOL } from './httpServer/resourceName/routes/resourceNameRouter';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { DbConfig } from './queue/interfaces';
import { pgBossFactory } from './queue';
import { JOB_LABELS_SYMBOL } from './k8s/constants';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = async (options?: RegisterOptions): Promise<DependencyContainer> => {
  const loggerConfig = config.get<LoggerOptions>('telemetry.logger');
  // @ts-expect-error the signature is wrong
  const logger = jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, hooks: { logMethod } });

  const metrics = new Metrics(SERVICE_NAME);
  const meter = metrics.start();

  const pgBossOptions = config.get<DbConfig>('db');
  const pgBoss = await pgBossFactory(pgBossOptions);

  const jobLabels:Record<string, string> = {
    app: 'job-chief',
    "owner-id": config.get('app.instanceUid'),
    environment: process.env.NODE_ENV ?? 'development',
  }

  const kubeConfig = new k8s.KubeConfig();

  kubeConfig.loadFromDefault();
  const k8sApi = kubeConfig.makeApiClient(k8s.CoreV1Api);
  const k8sJobApi = kubeConfig.makeApiClient(k8s.BatchV1Api);

  tracing.start();
  const tracer = trace.getTracer(SERVICE_NAME);

  const dependencies: InjectionObject<unknown>[] = [
    { token: SERVICES.CONFIG, provider: { useValue: config } },
    { token: SERVICES.LOGGER, provider: { useValue: logger } },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
    { token: SERVICES.METER, provider: { useValue: meter } },
    { token: JOB_LABELS_SYMBOL, provider: {useValue: jobLabels}},
    { token: PgBoss, provider: { useValue: pgBoss } },
    { token: SERVICES.K8S_API, provider: { useValue: k8sApi } },
    { token: SERVICES.K8S_JOB_API, provider: { useValue: k8sJobApi } },
    { token: SERVICES.K8S_CONFIG, provider: { useValue: kubeConfig } },
    { token: RESOURCE_NAME_ROUTER_SYMBOL, provider: { useFactory: resourceNameRouterFactory } },
    {
      token: 'onSignal',
      provider: {
        useValue: {
          useValue: async (): Promise<void> => {
            await Promise.all([tracing.stop(), metrics.stop()]);
          },
        },
      },
    },
  ];

  return registerDependencies(dependencies, options?.override, options?.useChild);
};
