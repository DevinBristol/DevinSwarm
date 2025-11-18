import type { Request, Response } from "express";
import { cfg } from "../config.js";
import { getContextSnapshot } from "../support/contextSnapshot.js";

export async function contextRoute(req: Request, res: Response) {
  const repoParam = String(req.query.repo || "").trim();
  const repo = repoParam || cfg.defaultRepo;
  const [owner, name] = repo.split("/");
  if (!owner || !name) {
    return res.status(400).json({ error: "repo must be <owner>/<repo>" });
  }
  try {
    const snap = await getContextSnapshot(repo);
    const { secrets, tokens, ...safe } = snap || {};
    res.json(safe);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "failed to load context" });
  }
}
