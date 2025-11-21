# Repository Guidelines

## Project Structure & Module Organization
DevinSwarm is a Node 20+ TypeScript repo built around the orchestrator-first design in `CODEx_RUNBOOK.md`. Keep graph/state/policy code in `/orchestrator`, HTTP adapters under `/service`, persistence queues inside `/runtime/{queue,store,events}`, and low-level integrations inside `/tools`. Workers (`dev`, `reviewer`, `research`, `ops`, `scout`) live under `/workers/*`, prompts under `/prompts`, and docs under `/docs`. Place UI assets such as `service/public/hitl.html` under `service/public/` and keep `*.spec.ts` files adjacent to their targets.

## Build, Test, and Development Commands
- `npm ci` – sync dependencies for the orchestrator stack.
- `npm run build` – compile TypeScript via `tsc -p tsconfig.json`.
- `docker compose -f infra/docker-compose.dev.yml up -d` – start the local Postgres + Redis stack.
- `npm run start:service` / `npm run start:worker` – run the HTTP service and worker to confirm `intake → plan → assign → report`.

### Local Dev Dependencies (PC-to-PC Checklist)
- Node `20.19.0` (honor `.nvmrc`; use `nvm use` or `fnm use` where available).
- npm `>=10` (run `npm --version` to confirm).
- Docker Desktop with Compose (`docker compose version` should succeed).
- A `.env` file copied from `.env.example` and updated with machine-specific secrets (never committed).
- Local Postgres/Redis via `docker compose -f infra/docker-compose.dev.yml up -d` before running workers or service.
- After switching machines: run `npm ci` once, then `npm run db:push` to ensure Prisma schema is applied.

## Coding Style & Naming Conventions
Follow `.editorconfig`: 2-space indent, LF, newline at EOF. Use strict TypeScript, ES modules, alphabetized imports, and `async` functions returning typed `Promise`s. Keep directories/file names `kebab-case`, exported types `PascalCase`, functions/vars `camelCase`, and env vars `SCREAMING_SNAKE_CASE`. Validate inputs with `zod` in `/orchestrator/state`, share constants through `/runtime/store`, and log via `winston`.

## Testing Guidelines
Name tests after the node or worker under test (`manager.graph.spec.ts`, `queue.spec.ts`). Prefer colocated unit tests plus lightweight integration runs that exercise the complete flow by running `npm run build && npm run start:service` alongside `npm run start:worker`, capturing logs that show a dummy task traversing all four states. Cover enqueue/reservation logic, HITL escalation triggers, and worker side effects; mock GitHub/filesystem calls but keep Redis/Postgres real for queue semantics.

## Commit & Pull Request Guidelines
Write imperative conventional commits such as `feat(orchestrator): stub assign node`. Every PR must include the runbook sections (**Goals**, **Plan**, **Artifacts**, **How to Unblock**) and note any required secrets or approvals via the escalation template before reallocating workers. Attach logs, screenshots, or traces that show new behavior, and block merging until `npm run build` (and future lint/tests) succeed.

## Security & Configuration Tips
Never commit `.env`; update `.env.example` whenever adding `OPENAI_API_KEY`, `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `REDIS_URL`, `DATABASE_URL` or `CHATKIT_*`. Load variables through `dotenv` solely in entry points and pass them explicitly elsewhere. Document scopes when requesting GitHub or ChatKit secrets, store them in Actions → Secrets, and avoid logging secret material—emit token names or short hashes instead.

