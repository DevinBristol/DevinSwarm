# Runbook

## 0) One‑time GitHub settings
- Settings → Actions → General → **Workflow permissions** → **Read and write**.
- Secrets:
  - `SFDX_URL_VALIDATION` — Sandbox auth URL (`sf org display --verbose` then `sf org generate password` if needed).
  - (later) `AGENT_SERVICE_URL`, `AGENT_SERVICE_TOKEN` for hosted Agent Service.

## 1) Local development
```bash
cd service
npm ci
cp .env.example .env
# set OPENAI_API_KEY and AGENT_SERVICE_TOKEN
npm run dev
```

## 2) Hosting (Render example)
- Create a **Web Service**, connect the repo.
- Build: `npm ci && npm run build`
- Start: `npm run start`
- Set env: `OPENAI_API_KEY`, `AGENT_SERVICE_TOKEN`, `WEBHOOK_SECRET`, (optional) `GH_PAT`, `GH_OWNER`, `GH_REPO`.

## 3) GitHub Webhook → Agent
- Repo → Settings → Webhooks → Add webhook
  - Payload URL: `https://<your-service>/webhooks/github`
  - Content type: `application/json`
  - Secret: value of `WEBHOOK_SECRET`
  - Events: Issues, Issue comments, Pull requests, Workflow runs.

## 4) Commands (from desktop or phone)
- Comment on an Issue/PR:
  - `/plan` — Manager posts a plan.
  - `/fix` — Dev/Test workers propose a patch & tests.
  - `/deploy` — Triggers the release workflow (if enabled).

## 5) Salesforce validation (PR)
- On PR, workflow logs in to your validation sandbox via `SFDX_URL_VALIDATION` and runs:
  - `sf project deploy validate --source-dir force-app --test-level RunLocalTests`
- If it fails, a CI failure Issue is opened; the Agent Service proposes next steps.
