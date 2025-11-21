// Emit a concise context bundle for Codex: SOT, git status/diff, recent events.
import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOT_PATH = path.join(ROOT, "docs", "source-of-truth.md");

const section = (title) => {
  console.log("");
  console.log(`=== ${title} ===`);
};

const runCmd = (cmd) => execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();

async function readSot() {
  try {
    const content = await fs.readFile(SOT_PATH, "utf8");
    return content;
  } catch (err) {
    return null;
  }
}

async function recentEvents(limit = 20) {
  if (!process.env.DATABASE_URL) return { error: "DATABASE_URL not set" };

  let pg;
  try {
    ({ Client: pg } = await import("pg"));
  } catch (err) {
    return { error: "pg dependency missing; run npm install" };
  }

  const client = new pg({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const res = await client.query(
      `select "runId","type","node","status","createdAt"
       from "Event"
       order by "createdAt" desc
       limit $1`,
      [limit],
    );
    return res.rows;
  } finally {
    await client.end();
  }
}

async function main() {
  section("Repo");
  console.log(`root: ${ROOT}`);
  console.log(`branch: ${runCmd("git rev-parse --abbrev-ref HEAD")}`);
  console.log(`latest origin/main: ${runCmd("git rev-parse origin/main")}`);

  section("Git Status");
  console.log(runCmd("git status --short") || "<clean>");

  section("Git Diff (stat vs origin/main)");
  console.log(runCmd("git diff --stat origin/main") || "<no diff>");

  section("Source of Truth (docs/source-of-truth.md)");
  const sot = await readSot();
  if (!sot) {
    console.log("missing locally; pull from origin/main");
  } else {
    console.log(sot);
  }

  section("Recent Events (last 20)");
  const events = await recentEvents();
  if (Array.isArray(events)) {
    events.forEach((e) => {
      console.log(
        `${e.createdat?.toISOString ? e.createdat.toISOString() : e.createdAt} ${e.runId} ${e.type} ${e.node ?? ""} ${e.status ?? ""}`,
      );
    });
    if (events.length === 0) console.log("<none>");
  } else {
    console.log(events.error);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
