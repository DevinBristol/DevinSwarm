import { execSync } from "node:child_process";

const SOT_PATH = "docs/source-of-truth.md";
const baseRef =
  process.env.SOT_BASE_REF ||
  (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "origin/main");

const run = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] }).trim();

const hasRef = () => {
  try {
    execSync(`git rev-parse ${baseRef}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

const range = hasRef() ? `${baseRef}...HEAD` : "HEAD";
const changed = run(`git diff --name-only ${range}`)
  .split("\n")
  .map((p) => p.trim())
  .filter(Boolean);

const touchedSot = changed.includes(SOT_PATH);
const meaningfulChanges = changed.filter(
  (p) =>
    p !== SOT_PATH &&
    !p.startsWith("docs/archive/") &&
    !p.startsWith(".github/pull_request_template.md") &&
    !p.startsWith(".github/workflows/ci.yml") &&
    !p.startsWith("scripts/codex_bootstrap.ps1") &&
    !p.startsWith("scripts/check-sot-updated.mjs"),
);

if (meaningfulChanges.length > 0 && !touchedSot) {
  console.error(
    [
      "Source of Truth not updated.",
      `Changed files (sans SOT): ${meaningfulChanges.join(", ")}`,
      `Please update ${SOT_PATH} (or intentionally include it in this diff) before merging.`,
    ].join("\n"),
  );
  process.exit(1);
}

console.log("Source of Truth check passed.");
