import { Job, Queue, Worker } from "bullmq";
import { Redis as RedisConstructor } from "ioredis";
import type { Redis as RedisClient } from "ioredis";

import type { RunInput } from "../../orchestrator/state/runState.js";

export type RunJobPayload = RunInput & { id: string };

export const RUN_QUEUE_NAME = "devinswarm-runs";

export function createRedisClient(redisUrl: string): RedisClient {
  return new RedisConstructor(redisUrl, {
    maxRetriesPerRequest: null,
  });
}

export function createRunQueue(
  client: RedisClient,
): Queue<RunJobPayload> {
  return new Queue<RunJobPayload>(RUN_QUEUE_NAME, {
    connection: client,
  });
}

export function createRunWorker(
  client: RedisClient,
  handler: (job: Job<RunJobPayload>) => Promise<void>,
): Worker<RunJobPayload> {
  return new Worker<RunJobPayload>(RUN_QUEUE_NAME, handler, {
    connection: client,
  });
}
