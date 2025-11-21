import { Queue, Worker, JobsOptions, QueueEvents } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

export const defaultJobOpts: JobsOptions = {
  removeOnComplete: 1000,
  removeOnFail: 1000,
  attempts: 2,
};

export const devQueue = new Queue("dev", {
  connection,
  defaultJobOptions: defaultJobOpts,
});
export const reviewQueue = new Queue("review", {
  connection,
  defaultJobOptions: defaultJobOpts,
});
export const opsQueue = new Queue("ops", {
  connection,
  defaultJobOptions: defaultJobOpts,
});
export const scoutQueue = new Queue("scout", {
  connection,
  defaultJobOptions: defaultJobOpts,
});

export function makeWorker(name: string, processor: any, concurrency = 2): Worker {
  return new Worker(name, processor, { connection, concurrency });
}

export function events(name: string): QueueEvents {
  return new QueueEvents(name, { connection });
}
