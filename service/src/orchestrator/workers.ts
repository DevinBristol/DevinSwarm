import fs from "node:fs";
import path from "node:path";
import { cfg } from "../config.js";
import { generate } from "../ai.js";

function load(p: string) { return fs.readFileSync(path.resolve("../" + p), "utf-8"); }

const prompts = {
  dev: load("agents/workers/dev.md"),
  test: load("agents/workers/test.md"),
  research: load("agents/workers/research.md"),
  ops: load("agents/workers/ops.md"),
  doc: load("agents/workers/doc.md")
};

export async function runWorkers(steps: Array<{who: string, what: string, id: string}>, context: string) {
  const prom = steps.map(async s => {
    const sys = prompts[s.who as keyof typeof prompts] || "You are a helpful worker.";
    const out = await generate({ system: sys, user: `Task: ${s.what}\nContext:\n${context}`, model: cfg.modelWorker });
    return { id: s.id, who: s.who, out };
  });
  return Promise.all(prom);
}
