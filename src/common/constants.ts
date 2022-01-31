import { readPackageJsonSync } from '@map-colonies/read-pkg';

export const SERVICE_NAME = readPackageJsonSync().name ?? 'unknown_service';
export const DEFAULT_SERVER_PORT = 80;

export const IGNORED_OUTGOING_TRACE_ROUTES = [/^.*\/v1\/metrics.*$/];
export const IGNORED_INCOMING_TRACE_ROUTES = [/^.*\/docs.*$/];

/* eslint-disable @typescript-eslint/naming-convention */
export const SERVICES: Record<string, symbol> = {
  LOGGER: Symbol('Logger'),
  CONFIG: Symbol('Config'),
  TRACER: Symbol('Tracer'),
  METER: Symbol('Meter'),
  K8S_CONFIG: Symbol('KubeConfig'),
  K8S_API: Symbol('K8sApi'),
  K8S_JOB_API: Symbol('K8sJobApi'),
  K8S_JOB_INFORMER: Symbol('K8sJobInformer'),
  K8S_JOB_FACTORY: Symbol('K8sJobFactory'),
};
/* eslint-enable @typescript-eslint/naming-convention */
