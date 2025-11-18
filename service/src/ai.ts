import OpenAI from "openai";
import { cfg } from "./config.js";

let client: OpenAI | null = null;

export function openai() {
  if (!client) client = new OpenAI({ apiKey: cfg.openaiKey });
  return client;
}

export async function generate(opts: { system: string; user: string; model: string; }) {
  const res = await openai().chat.completions.create({
    model: opts.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user }
    ],
    temperature: 0.2
  });
  return res.choices[0]?.message?.content ?? "";
}
