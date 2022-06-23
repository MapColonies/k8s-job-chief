import { readPackageJsonSync } from '@map-colonies/read-pkg';

export const SERVICE_NAME = readPackageJsonSync().name ?? 'unknown_service';
export const DEFAULT_SERVER_PORT = 8080;

export const IGNORED_OUTGOING_TRACE_ROUTES = [/^.*\/v1\/metrics.*$/];
export const IGNORED_INCOMING_TRACE_ROUTES = [/^.*\/docs.*$/, /^.*\/metrics.*/];

export const LIVENESS_PROBE_FACTORY = Symbol('LivenessProbeFactory');
export const JOB_CLEANER_FACTORY = Symbol('jobCleanerFactory');

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
  JOB_LIFECYCLE_WRAPPER_FACTORY: Symbol('JobLifecyleWrapperFactory'),
  MANAGER_PGBOSS: Symbol('ManagerPgBoss'),
  JOB_SCHEDULER: Symbol('JobScheduler'),
};
