import { z } from "zod";

const taskSchema = z.object({
  title: z.string(),
  role: z.enum(["plan", "dev", "review", "ops"]).default("dev"),
  status: z.enum(["pending", "in_progress", "done", "blocked"]).default("pending"),
  notes: z.string().optional(),
});

export const retriesSchema = z.object({
  plan: z.number().int().nonnegative().default(0),
  dev: z.number().int().nonnegative().default(0),
  review: z.number().int().nonnegative().default(0),
  ops: z.number().int().nonnegative().default(0),
});

export const runInputSchema = z.object({
  id: z.string().uuid().optional(),
  source: z.string().default("manual"),
  repo: z.string().min(1, "repo is required"),
  branch: z.string().default("main"),
  description: z.string().min(1, "description is required"),
  title: z.string().optional(),
  planSummary: z.string().nullable().optional(),
  tasks: z.array(taskSchema).default([]),
});

export type RunInput = z.infer<typeof runInputSchema>;

export const runStateSchema = z.object({
  id: z.string().uuid(),
  repo: z.string(),
  branch: z.string(),
  title: z.string().optional(),
  description: z.string(),
  planSummary: z.string().nullable().optional(),
  status: z.enum(["queued", "running", "blocked", "completed", "failed"]),
  phase: z.enum(["intake", "plan", "dev", "review", "ops", "report"]).default("intake"),
  currentNode: z
    .enum(["intake", "plan", "dev-execute", "review", "ops", "report", "escalate"])
    .default("intake"),
  tasks: z.array(taskSchema).default([]),
  retries: retriesSchema.default({
    plan: 0,
    dev: 0,
    review: 0,
    ops: 0,
  }),
  artifacts: z
    .array(
      z.object({
        type: z.string(),
        path: z.string().optional(),
        url: z.string().optional(),
        summary: z.string().optional(),
      }),
    )
    .default([]),
  evaluation: z.record(z.any()).optional(),
  resultSummary: z.string().optional(),
});

export type RunState = z.infer<typeof runStateSchema>;

