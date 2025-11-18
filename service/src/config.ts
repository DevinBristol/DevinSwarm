export const cfg = {
  port: Number(process.env.PORT || 8787),
  openaiKey: process.env.OPENAI_API_KEY || "",
  modelManager: process.env.OPENAI_MODEL_MANAGER || "gpt-4o",
  modelWorker: process.env.OPENAI_MODEL_WORKER || "gpt-4o-mini",
  agentToken: process.env.AGENT_SERVICE_TOKEN || "",
  webhookSecret: process.env.WEBHOOK_SECRET || "",
  gh: {
    pat: process.env.GH_PAT || "",
    owner: process.env.GH_OWNER || "",
    repo: process.env.GH_REPO || ""
  },
  budgetUsdDaily: Number(process.env.BUDGET_USD_DAILY || 25),
  maxToolCalls: Number(process.env.MAX_TOOL_CALLS || 20)
};
