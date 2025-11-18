import dotenv from "dotenv";

dotenv.config();

import express, {
  type Request,
  type Response,
} from "express";
import winston from "winston";
import { v4 as uuidv4 } from "uuid";
import { ZodError } from "zod";

import {
  runInputSchema,
  type RunInput,
} from "../orchestrator/state/runState.js";
import {
  createRedisClient,
  createRunQueue,
} from "../runtime/queue/queue.js";
import { SqliteRunStore } from "../runtime/store/sqliteStore.js";

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

async function bootstrap(): Promise<void> {
  const app = express();
  app.use(express.json());

  const port = Number.parseInt(
    process.env.PORT ?? "3000",
    10,
  );
  const redisUrl =
    process.env.REDIS_URL ?? "redis://localhost:6379";
  const sqliteUrl =
    process.env.SQLITE_URL ?? "devinswarm.db";

  const redisClient = createRedisClient(redisUrl);
  const runQueue = createRunQueue(redisClient);
  const store = new SqliteRunStore(sqliteUrl);

  app.get(
    "/healthz",
    (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.post(
    "/intake",
    async (req: Request, res: Response) => {
    try {
      const parsed: RunInput =
        runInputSchema.parse(req.body);
      const runId = parsed.id ?? uuidv4();
      const now = new Date().toISOString();

      store.createRun({
        id: runId,
        status: "queued",
        description: parsed.description,
        resultSummary: undefined,
        createdAt: now,
        updatedAt: now,
      });

      await runQueue.add("run", {
        ...parsed,
        id: runId,
      });

      res.status(202).json({ id: runId });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: "Invalid request",
          issues: error.issues,
        });

        return;
      }

      logger.error("Failed to enqueue run", { error });
      res
        .status(500)
        .json({ error: "Internal Server Error" });
    }
  });

  app.get(
    "/runs/:id",
    (req: Request, res: Response) => {
    const run = store.getRun(req.params.id);

    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }

    res.json(run);
  });

  app.listen(port, () => {
    logger.info(`Service listening on port ${port}`);
  });
}

bootstrap().catch((error: unknown) => {
  logger.error("Failed to start service", { error });
  process.exit(1);
});
