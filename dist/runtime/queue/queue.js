import { Queue, Worker } from "bullmq";
import { Redis as RedisConstructor } from "ioredis";
export const RUN_QUEUE_NAME = "devinswarm-runs";
export function createRedisClient(redisUrl) {
    return new RedisConstructor(redisUrl);
}
export function createRunQueue(client) {
    return new Queue(RUN_QUEUE_NAME, {
        connection: client,
    });
}
export function createRunWorker(client, handler) {
    return new Worker(RUN_QUEUE_NAME, handler, {
        connection: client,
    });
}
//# sourceMappingURL=queue.js.map