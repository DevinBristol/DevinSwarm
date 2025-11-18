# Optional helper to install common tools on Windows (requires admin for some steps)
Write-Host "Installing tools for the Swarm starter..."

# 1) Git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  winget install --id Git.Git -e --source winget
}

# 2) Node.js LTS
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  winget install OpenJS.NodeJS.LTS
}

# 3) Salesforce CLI
npm i -g @salesforce/cli

# 4) GitHub CLI (optional)
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  winget install GitHub.cli
}

Write-Host "Done. Close and reopen your terminal if new commands aren't found."
