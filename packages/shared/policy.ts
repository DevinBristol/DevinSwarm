export const DAILY_BUDGET_USD = Number(process.env.DAILY_BUDGET_USD ?? 75);
export const AUTO_MERGE_LOW_RISK = (process.env.AUTO_MERGE_LOW_RISK ?? "true") === "true";
export const ALLOWED_REPOS = new Set(
  (process.env.ALLOWED_REPOS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

// naive file-based low-risk heuristic; refine later
export function isLowRiskChangedFiles(files: string[]): boolean {
  const risky = [
    /^src\/security\//,
    /^infra\//,
    /^database\//,
    /package\.json$/,
    /render\.yaml$/,
  ];
  if (files.length > 50) return false;
  return files.every((f) => !risky.some((rx) => rx.test(f)));
}

