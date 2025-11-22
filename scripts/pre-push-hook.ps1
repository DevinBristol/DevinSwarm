# Sample pre-push hook to enforce doc/runbook sync locally.
# Install (PowerShell):
#   New-Item -ItemType SymbolicLink -Path .git/hooks/pre-push -Target ../../scripts/pre-push-hook.ps1

Write-Output "[pre-push] running npm run check:sot"
npm run check:sot
Write-Output "[pre-push] done"
