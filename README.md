# Manager–Worker **Swarm** Starter

Day‑1 scaffolding for a hosted multi‑agent Manager/Workers framework that integrates with GitHub and Salesforce.
This starter gives you:

- **Agent Service** (Node/TypeScript, Express) with a Manager that fans out to Workers (dev/test/research/ops/doc).
- **GitHub Actions** for PR validation in Salesforce + CI‑failure auto‑issue + intake/command webhooks.
- **Salesforce project** layout (`force-app/`) with a tiny Apex class & test so validation can run immediately.
- **Docs**: Mission, Design, Ops Runbook.
- **Render/Fly-ready** container (Dockerfile) for quick hosting.
- **Mobile-friendly commands**: comment `/plan`, `/fix`, `/deploy` on Issues/PRs to trigger the service.

> Safe-by-default: service comments plans by default; auto‑PRs are gated behind an explicit toggle.

---

## Quick Start (local smoke test)

1) **Prereqs** (Windows PowerShell):
```powershell
# optional helper to install common tools
.\scripts\windows_bootstrap.ps1
```

2) **Install & run the Agent Service locally**:
```powershell
cd service
npm ci
copy .env.example .env
# set OPENAI_API_KEY and AGENT_SERVICE_TOKEN in .env
npm run dev
# server listens on http://localhost:8787
```

3) **GitHub repo**:
```powershell
git init
git add -A
git commit -m "feat: bootstrap swarm starter"
git branch -M main
git remote add origin https://github.com/DevinBristol/DevinSwarm.git
git push -u origin main
```

4) **Repo settings (important)**:
- Settings → Actions → General → **Workflow permissions** → **Read and write permissions**.
- Add **Secrets and variables → Actions → New repository secret**:
  - `SFDX_URL_VALIDATION` — auth URL for your Salesforce validation sandbox.
  - (optional) `AGENT_SERVICE_URL` and `AGENT_SERVICE_TOKEN` — once you host the service.

5) **Try a PR**:
- Open a PR that includes the preloaded `force-app` files.
- The **PR Validate (Salesforce)** workflow runs and comments the status on the PR.
- If it fails, a **CI failure** Issue is created automatically.

See `docs/runbook.md` for full instructions.
