Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Codex startup helper: fetch latest main, surface the Source of Truth (SOT),
# and show how local SOT differs from origin/main.

$sotPath = "docs/source-of-truth.md"
$resetFlag = $env:CODEX_RESET_TO_ORIGIN_MAIN -eq "1"

try {
  $repoRoot = git rev-parse --show-toplevel
} catch {
  Write-Error "Not inside a git repository." -ErrorAction Stop
}

Set-Location $repoRoot

Write-Host "== Codex bootstrap ==" -ForegroundColor Cyan
Write-Host "Repo root: $repoRoot"
Write-Host "Current branch:" (git rev-parse --abbrev-ref HEAD)

git fetch --prune
Write-Host "`nFetched origin; comparing SOT to origin/main..."

if ($resetFlag) {
  Write-Host "`nCODEX_RESET_TO_ORIGIN_MAIN=1 set; syncing to origin/main..."
  git checkout main
  git reset --hard origin/main
  Write-Host "Working tree reset to origin/main."
} else {
  Write-Host "`nTo force this workspace to match origin/main, rerun with CODEX_RESET_TO_ORIGIN_MAIN=1 (WARNING: discards local changes)."
}

if (-not (Test-Path $sotPath)) {
  Write-Warning "SOT missing locally at $sotPath. Create/update it on main."
} else {
  Write-Host "`nLocal SOT status:"
  git status --short -- $sotPath
}

try {
  Write-Host "`nLatest SOT from origin/main:"
  git show origin/main:$sotPath
} catch {
  Write-Warning "Could not read $sotPath from origin/main. Has it been created on main?"
}

Write-Host "`nDiff vs origin/main (stat):"
git diff --stat origin/main -- $sotPath
Write-Host "`nDiff vs origin/main:"
git diff origin/main -- $sotPath

Write-Host "`nReminder: edit the SOT on main and prepend Session Log entries for each working session."
