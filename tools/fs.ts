import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "crypto";

export interface WorkspacePaths {
  root: string;
  tempDir: string;
}

export function describeWorkspace(
  paths: WorkspacePaths,
): string {
  return `Workspace at ${paths.root} (temp: ${paths.tempDir})`;
}

export function createWorkspace(
  runId: string,
): WorkspacePaths {
  const base = path.join(os.tmpdir(), "devinswarm");
  const root = path.join(base, runId || randomUUID());
  const tempDir = path.join(root, "tmp");

  fs.mkdirSync(tempDir, { recursive: true });

  return { root, tempDir };
}

export function cleanupWorkspace(
  paths: WorkspacePaths,
): void {
  try {
    fs.rmSync(paths.root, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
}

export function writeTextFileSafe(
  filePath: string,
  content: string,
): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}
