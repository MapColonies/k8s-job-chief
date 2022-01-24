import { Logger } from '@map-colonies/js-logger';
import { Meter } from '@map-colonies/telemetry';
import { BoundCounter } from '@opentelemetry/api-metrics';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import * as k8s from '@kubernetes/client-node';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../../common/constants';

import { IResourceNameModel, ResourceNameManager } from '../models/resourceNameManager';

type CreateResourceHandler = RequestHandler<undefined, IResourceNameModel, IResourceNameModel>;
type GetResourceHandler = RequestHandler<undefined, any>;

const kc = new k8s.KubeConfig();

kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sJobApi = kc.makeApiClient(k8s.BatchV1Api);
const watch = new k8s.Watch(kc);

// const listFn = async () => k8sApi.listNamespacedPod('default', undefined, undefined, undefined, undefined);

// const informer = k8s.makeInformer(kc, '/api/v1/namespaces/default/pods', listFn);

// informer.on('update', (obj) => {
//   console.log('obj', obj);
//   console.log('container statuses',obj.status?.containerStatuses);
//   console.log('container 0 state', obj.status?.containerStatuses?.[0].state);
//   console.log('owner references', obj.metadata?.ownerReferences?.[0]);
// });

// informer.start().then().catch(console.error)
const jobListFn = async () => k8sJobApi.listNamespacedJob('default', undefined, undefined, undefined, undefined);

const informer = k8s.makeInformer(kc, '/apis/batch/v1/namespaces/default/jobs', jobListFn);

informer.on('update', (obj) => {
  console.log('obj', obj);
  console.log('conditions', obj.status?.conditions);
});

informer.start().then().catch(console.error);

k8sJobApi
  .createNamespacedJob('default', {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: { name: 'pi' },
    spec: {
      template: {
        metadata: { name: 'pi' },
        spec: {
          containers: [{ name: 'pi', imagePullPolicy: 'Never', image: 'perl', command: ['exit', '1'] }],
          restartPolicy: 'Never',
        },
      },
      backoffLimit: 0,
    },
  })
  .then((res) => {
    console.log(res.response.statusCode);

    if (res.response.statusCode === httpStatus.CREATED) {
      const uid = res.body.metadata?.uid;
      // watch
      //   .watch(
      //     '/api/v1/namespaces/default/pods',
      //     {},
      //     (phase, apiObj, watchObj) => {
      //       // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      //       console.log(phase, apiObj.object.status, watchObj);
      //     },
      //     console.error
      //   )
      //   .then((req) => {
      //     // watch returns a request object which you can use to abort the watch.
      //     setTimeout(() => {
      //       // eslint-disable-next-line
      //       req.abort();
      //       // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      //     }, 10 * 10000000);
      //   })
      //   .catch(console.error);
    }
  })
  .catch(console.error);

// watch
//   .watch('/apis/batch/v1/namespaces/default/jobs', {}, (phase, apiObj, watchObj) => {
//     console.log(phase, apiObj, watchObj);
//   }, console.error)
//   .then((req) => {
//     // watch returns a request object which you can use to abort the watch.
//     setTimeout(() => {
//       // eslint-disable-next-line
//       req.abort();
//     // eslint-disable-next-line @typescript-eslint/no-magic-numbers
//     }, 10 * 10000000);
//   })
//   .catch(console.error);

// watch
//   .watch(
//     '/apis/v1/namespaces/default/pods',
//     {},
//     (phase, apiObj, watchObj) => {
//       console.log(phase, apiObj, watchObj);
//     },
//     console.error
//   )
//   .then((req) => {
//     // watch returns a request object which you can use to abort the watch.
//     setTimeout(() => {
//       // eslint-disable-next-line
//       req.abort();
//       // eslint-disable-next-line @typescript-eslint/no-magic-numbers
//     }, 10 * 10000000);
//   })
//   .catch(console.error);
@injectable()
export class ResourceNameController {
  private readonly createdResourceCounter: BoundCounter;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(ResourceNameManager) private readonly manager: ResourceNameManager,
    @inject(SERVICES.METER) private readonly meter: Meter
  ) {
    this.createdResourceCounter = meter.createCounter('created_resource');
  }

  public getResource: GetResourceHandler = async (req, res) => {
    const pods = await k8sApi.listNamespacedPod('default');
    return res.status(httpStatus.OK).json(pods);
  };

  public createResource: CreateResourceHandler = (req, res) => {
    const createdResource = this.manager.createResource(req.body);
    this.createdResourceCounter.add(1);
    return res.status(httpStatus.CREATED).json(createdResource);
  };
}
