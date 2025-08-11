# ICN MCP Agent HQ

MCP server and agent ecosystem to orchestrate AI agents for ICN development. Everything via PRs, under policy and invariants.

## Dev Quickstart
- Node 20 (`nvm use`)
- `npm i`
- `npm run lint && npm test && npm run build`
- `npm run -w mcp-server dev` then GET `http://localhost:8787/healthz` → `{ ok: true }`

## API Overview

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/healthz` | GET | None | Health check |
| `/metrics` | GET | None | Prometheus metrics |
| `/api/agent/register` | POST | Bootstrap* | Register agent |
| `/api/agent/refresh` | POST | Bearer | Refresh token |
| `/api/task/create` | POST | Bearer | Create task |
| `/api/task/claim` | POST | Bearer | Claim task |
| `/api/task/run` | POST | Bearer | Report progress |
| `/api/pr/create` | POST | Bearer | Create PR |
| `/api/webhooks/github` | POST | HMAC | GitHub webhook |

\* Bootstrap: First agent needs no auth; subsequent require Bearer token.

[Complete API Documentation →](docs/api/mcp-server.md)

## Configuration

Set environment variables to target different repositories:

```bash
export GITHUB_OWNER=YourOrg           # Default: InterCooperative-Network
export GITHUB_REPO=your-repo          # Default: icn-mcp
export GITHUB_DEFAULT_BRANCH=develop  # Default: main
export GITHUB_TOKEN=ghp_your_token    # Required for GitHub PR creation
export WEBHOOK_SECRET=your_secret     # Required for webhook verification
```

## Webhooks
- Configure GitHub webhook to `POST /api/webhooks/github` with `WEBHOOK_SECRET`
- Webhook events automatically link to tasks via `Task-ID: task_abc123` markers in issue/PR bodies

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
