import { Queue, Worker, JobsOptions, QueueEvents } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

export const devQueue = new Queue("dev", { connection });
export const reviewQueue = new Queue("review", { connection });
export const scoutQueue = new Queue("scout", { connection });

export const defaultJobOpts: JobsOptions = {
  removeOnComplete: 1000,
  removeOnFail: 1000,
  attempts: 2,
};

export function makeWorker(name: string, processor: any, concurrency = 2): Worker {
  return new Worker(name, processor, { connection, concurrency });
}

export function events(name: string): QueueEvents {
  return new QueueEvents(name, { connection });
}
