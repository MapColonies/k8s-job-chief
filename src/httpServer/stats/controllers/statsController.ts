import { Logger } from '@map-colonies/js-logger';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../../common/constants';
import { QueueStat } from '../../../queue/queueProvider';

import { StatsManager } from '../models/statsManager';

type GetStatsHandler = RequestHandler<undefined, Record<string, QueueStat>>;

@injectable()
export class StatsController {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(StatsManager) private readonly manager: StatsManager) {}

  public getResource: GetStatsHandler = async (req, res) => {
    const stats = await this.manager.getStats();
    return res.status(httpStatus.OK).json(stats);
  };
}
