# ICN MCP Agent HQ

MCP server and agent ecosystem to orchestrate AI agents for ICN development. Everything via PRs, under policy and invariants.

## Dev Quickstart
- Node 20 (`nvm use`)
- `npm i`
- `npm run lint && npm test && npm run build`
- `npm run -w mcp-server dev` then GET `http://localhost:8787/healthz` → `{ ok: true }`

## Webhooks
- Configure GitHub webhook to `POST /api/webhooks/github` with `WEBHOOK_SECRET`

## Worker Protocol
- `POST /api/task/claim` (Bearer)
- `POST /api/task/run` (Bearer)
- `GET /api/task/status?task_id=...`

## Context Briefs
- `GET /api/context/brief?task_id=...`

### Agents quickstart

With the server running:

```bash
# Planner creates tasks from Intent-0001
node agents/planner/src/index.ts

# Architect drafts signing-context and creates a local PR descriptor
node agents/architect/src/index.ts --task <TASK_ID>
```

Artifacts are written to `branches/<taskId>/...` and `artifacts/PR-<taskId>.json`.
# icn-mcp
ICN MCP Agent HQ
