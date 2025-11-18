import type { Request, Response } from "express";
import { getContextSnapshot } from "../support/contextSnapshot.js";

export async function contextRoute(req: Request, res: Response) {
  const repo = String(req.query.repo || process.env.DEFAULT_REPO || "");
  if (!repo.includes("/")) return res.status(400).json({ error: "repo must be <owner>/<repo>" });
  try {
    const snap = await getContextSnapshot(repo);
    const { secrets, ...safe } = snap || {};
    res.json(safe);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "failed to load context" });
  }
}

