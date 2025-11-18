import dotenv from "dotenv";

dotenv.config();

import winston from "winston";

import { runDevWorkflow } from "../../orchestrator/graph/manager.graph.js";
import { createRedisClient, createRunWorker } from "../../runtime/queue/queue.js";
import { SqliteRunStore } from "../../runtime/store/sqliteStore.js";

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

async function main(): Promise<void> {
  const redisUrl =
    process.env.REDIS_URL ?? "redis://localhost:6379";
  const sqliteUrl =
    process.env.SQLITE_URL ?? "devinswarm.db";

  const redisClient = createRedisClient(redisUrl);
  const store = new SqliteRunStore(sqliteUrl);

  createRunWorker(redisClient, async (job) => {
    logger.info(`Processing run ${job.data.id}`, {
      jobId: job.id,
    });

    const result = await runDevWorkflow(job.data);

    const now = new Date().toISOString();

    store.updateRun(job.data.id, {
      status: "completed",
      resultSummary:
        result.planSummary ?? "Run completed successfully",
      updatedAt: now,
    });

    logger.info(`Completed run ${job.data.id}`);
  });

  logger.info("Dev worker started");
}

main().catch((error: unknown) => {
  console.error("Dev worker failed raw", error);
  logger.error("Dev worker failed", { error });
  process.exit(1);
});

