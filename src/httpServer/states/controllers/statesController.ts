import { Logger } from '@map-colonies/js-logger';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../../common/constants';
import { QueueStat } from '../../../queue/interfaces';
import { StatesManager } from '../models/statesManager';

type GetStatesHandler = RequestHandler<undefined, Record<string, QueueStat>>;

@injectable()
export class StatesController {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(StatesManager) private readonly manager: StatesManager) {}

  public getStates: GetStatesHandler = async (req, res) => {
    this.logger.debug({ msg: 'getting states' });

    const states = await this.manager.getStates();
    return res.status(httpStatus.OK).json(states);
  };
}
