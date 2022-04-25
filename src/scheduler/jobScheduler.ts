export interface JobScheduler {
  scheduleJob: (name: string, startAfter?: number) => Promise<string | null>;
  handleJobs: (handler: (data: { name: string }) => Promise<void>, signal: AbortSignal) => Promise<void>;
}
