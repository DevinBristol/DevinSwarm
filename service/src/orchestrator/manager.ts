import fs from "node:fs";
import path from "node:path";
import { cfg } from "../config.js";
import { generate } from "../ai.js";
import { runWorkers } from "./workers.js";

const managerPrompt = fs.readFileSync(path.resolve("../agents/manager/system_prompt.md"), "utf-8");

export async function runManager(context: string) {
  const planJson = await generate({
    system: managerPrompt,
    user: `Context:\n${context}\nReturn only the JSON plan.`,
    model: cfg.modelManager
  });
  let plan: any;
  try { plan = JSON.parse(planJson); } catch {
    // if model returns md fenced code, attempt to extract
    const m = planJson.match(/\{[\s\S]*\}/);
    plan = m ? JSON.parse(m[0]) : { goal: "unknown", steps: [] };
  }

  const workerInputs = (plan.steps || []).map((s: any) => ({
    who: s.who, what: s.what, id: s.id
  }));

  const results = await runWorkers(workerInputs, context);
  return { plan, results };
}
