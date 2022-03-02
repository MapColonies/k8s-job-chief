export interface QueueStat {
  created: number;
  retry: number;
  active: number;
  completed: number;
  expired: number;
  cancelled: number;
  failed: number;
  all: number;
}
