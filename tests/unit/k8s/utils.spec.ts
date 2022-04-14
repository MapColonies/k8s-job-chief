import { K8sConfig, PodConfig } from '../../../src/k8s/interfaces';
import { flattenLabels, createEnvFrom, createJobSpec } from '../../../src/k8s/utils';
import { DbConfig } from '../../../src/queue/pgbossFactory';

describe('#flattenLabels', () => {
  it('should reduce the labels record to a string of key value pairs', () => {
    expect(flattenLabels({ foo: 'bar', baz: 'qux' })).toBe('foo=bar,baz=qux');
  });

  it('should return an empty string if the record is empty', () => {
    expect(flattenLabels({})).toBe('');
  });
});

describe('#createEnvFrom', () => {
  it('should create an array of k8s.V1EnvFromSource objects', () => {
    expect(createEnvFrom(['configmap-1', 'configmap-2'], ['secret-1', 'secret-2'])).toEqual([
      { configMapRef: { name: 'configmap-1' } },
      { configMapRef: { name: 'configmap-2' } },
      { secretRef: { name: 'secret-1' } },
      { secretRef: { name: 'secret-2' } },
    ]);
  });

  it('should return an empty array if no configmaps or secrets are provided', () => {
    expect(createEnvFrom([], [])).toEqual([]);
  });
});

describe('#createJobSpec', () => {
  it('should create a k8s.V1Job object', () => {
    const podConfig: PodConfig = {
      image: 'image',
      command: ['command'],
      args: ['arg'],

      env: [{ name: 'foo', value: 'bar' }],
      resources: {
        limits: {
          cpu: '1',
          memory: '2Gi',
        },
        requests: {
          cpu: '1',
          memory: '2Gi',
        },
      },
      injectPgConfig: true,
      parallelism: 1,
      liveness: { enabled: true, initialDelaySeconds: 1, path: 'path', periodSeconds: 1, port: 1, timeoutSeconds: 1 },
      pullPolicy: 'IfNotPresent',
    };

    const dbConfig: DbConfig = {
      host: 'host',
      port: 1234,
      user: 'user',
      password: 'password',
      database: 'database',
      certSecretName: 'cert-secret-name',
      schema: 'schema',
      enableSslAuth: true,
      sslPaths: {
        ca: 'ca-path',
        cert: 'cert-path',
        key: 'key-path',
      },
    };

    const labels = {
      foo: 'bar',
      baz: 'qux',
    };

    const k8sConfig: K8sConfig = {
      namespace: 'namespace',
      loadConfigFromCluster: false,
    };

    const jobSpec = createJobSpec('instance-uid', 'queue-name', podConfig, dbConfig, labels, k8sConfig);

    expect(jobSpec).toEqual({
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        generateName: 'job-chief-instance-uid-queue-name-',
        labels: { 'queue-name': 'queue-name', foo: 'bar', baz: 'qux' },
        namespace: 'namespace',
      },
      spec: {
        parallelism: 1,
        backoffLimit: 0,
        template: {
          metadata: { name: 'job-chief-queue-name-pod', labels: { foo: 'bar', baz: 'qux', 'queue-name': 'queue-name' } },
          spec: {
            imagePullSecrets: [{}],
            restartPolicy: 'Never',
            containers: [
              {
                name: 'worker',
                image: 'image',
                imagePullPolicy: 'IfNotPresent',
                command: ['command'],
                args: ['arg'],
                env: [
                  { name: 'QUEUE_NAME', value: 'queue-name' },
                  { name: 'foo', value: 'bar' },
                  { name: 'DB_HOST', value: 'host' },
                  { name: 'DB_PORT', value: '1234' },
                  { name: 'DB_USERNAME', value: 'user' },
                  { name: 'DB_PASSWORD', value: 'password' },
                  { name: 'DB_NAME', value: 'database' },
                  { name: 'DB_SCHEMA', value: 'schema' },
                  { name: 'DB_ENABLE_SSL_AUTH', value: 'true' },
                  { name: 'DB_CA_PATH', value: 'ca-path' },
                  { name: 'DB_CERT_PATH', value: 'cert-path' },
                  { name: 'DB_KEY_PATH', value: 'key-path' },
                ],
                resources: { limits: { cpu: '1', memory: '2Gi' }, requests: { cpu: '1', memory: '2Gi' } },
                envFrom: [],
                livenessProbe: { timeoutSeconds: 1, initialDelaySeconds: 1, periodSeconds: 1, httpGet: { path: 'path', port: 1 } },
                volumeMounts: [{ name: 'db-ssl-certs', mountPath: '.', readOnly: true }],
              },
            ],
            volumes: [{ name: 'db-ssl-certs', secret: { secretName: 'cert-secret-name' } }],
          },
        },
      },
    });
  });
});
