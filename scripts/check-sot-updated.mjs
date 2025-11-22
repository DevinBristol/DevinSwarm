#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const banner = 'Source of truth is `CODEx_RUNBOOK.md` - this file is a focused view. Do not diverge from the runbook.';
const repoRoot = process.cwd();

const requiredFiles = [
  'CODEx_RUNBOOK.md',
  'AGENTS.md',
  'DEVINSWARM_RENDER_NEXT_STEPS.md',
  'SWARM_PING.md',
  'docs/INDEX.md',
  'docs/plans/devinswarm-docs-plan.md',
  'docs/source-of-truth.md',
  'docs/design.md',
  'docs/phase-1-followups.md',
  'docs/runbook.md',
  'docs/self-iteration-plan.md',
];

const filesNeedingBanner = [
  'AGENTS.md',
  'DEVINSWARM_RENDER_NEXT_STEPS.md',
  'SWARM_PING.md',
  'docs/INDEX.md',
  'docs/plans/devinswarm-docs-plan.md',
  'docs/source-of-truth.md',
  'docs/design.md',
  'docs/phase-1-followups.md',
  'docs/runbook.md',
  'docs/self-iteration-plan.md',
];

const codePathsRequiringRunbook = [
  'apps/',
  'orchestrator/',
  'runtime/',
  'packages/',
  'prompts/',
  'tools/',
  'infra/',
  'scripts/',
  'render.yaml',
  '.github/',
  'DEVINSWARM_RENDER_NEXT_STEPS.md',
  'SWARM_PING.md',
  'AGENTS.md',
];

function readFile(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), 'utf8');
}

function fileExists(filePath) {
  return fs.existsSync(path.join(repoRoot, filePath));
}

function getChangedFiles() {
  const commands = [
    'git diff --name-only --cached',
    'git diff --name-only',
  ];
  for (const cmd of commands) {
    try {
      const output = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (output) {
        return output.split('\n').filter(Boolean);
      }
    } catch {
      // ignore and try next
    }
  }
  return [];
}

function ensureRequiredFiles() {
  const missing = requiredFiles.filter((f) => !fileExists(f));
  if (missing.length) {
    throw new Error(`Missing required documentation files: ${missing.join(', ')}`);
  }
}

function ensureBanners() {
  const missingBanner = filesNeedingBanner.filter((f) => {
    const content = readFile(f);
    return !content.includes(banner);
  });
  if (missingBanner.length) {
    throw new Error(`Missing SOT banner in: ${missingBanner.join(', ')}`);
  }
}

function ensureRunbookTouchedWhenNeeded(changedFiles) {
  if (!changedFiles.length) return;
  const runbookChanged = changedFiles.includes('CODEx_RUNBOOK.md');
  const nonArchived = changedFiles.filter((f) => !f.startsWith('docs/archive/'));
  const needsRunbook = nonArchived.some((f) => codePathsRequiringRunbook.some((prefix) => f === prefix || f.startsWith(prefix)));
  if (needsRunbook && !runbookChanged) {
    throw new Error(`Runbook not updated. Changed files requiring runbook sync: ${nonArchived.join(', ')}`);
  }
}

function main() {
  ensureRequiredFiles();
  ensureBanners();
  const changed = getChangedFiles();
  ensureRunbookTouchedWhenNeeded(changed);
  console.log('check:sot passed');
}

main();
