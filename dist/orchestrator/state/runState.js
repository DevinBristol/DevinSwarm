import { z } from "zod";
export const runInputSchema = z.object({
    id: z.string().uuid().optional(),
    source: z.string().default("manual"),
    description: z.string().min(1, "description is required"),
});
export const runStateSchema = z.object({
    id: z.string().uuid(),
    status: z.enum(["queued", "running", "completed", "failed"]),
    description: z.string(),
    resultSummary: z.string().optional(),
});
//# sourceMappingURL=runState.js.map