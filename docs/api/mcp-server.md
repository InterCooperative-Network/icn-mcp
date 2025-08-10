## MCP Server API Extensions (v0.2)

### Webhooks
- POST `/api/webhooks/github`
  - HMAC (sha256) via `X-Hub-Signature-256`
  - Env: `WEBHOOK_SECRET`
  - Handles: `issues`, `issue_comment`, `pull_request`, `check_suite`

### Context Briefing
- GET `/api/context/brief?task_id=<id>`
  - Returns TaskBrief JSON

### Worker Protocol
- POST `/api/task/claim` (Bearer auth)
- POST `/api/task/run` (Bearer auth)
- GET `/api/task/status?task_id=<id>`

### GitHub Integration
- POST `/api/gh/issue/create` (Bearer auth)
- POST `/api/pr/create` (Bearer auth)

## MCP Server API

Base URL: http://localhost:8787

### Health

GET /healthz

Response:

```json
{ "ok": true }
```

### Register Agent

POST /api/agent/register

Bootstrap: allowed without token only if no agents exist.

Request:

```json
{ "name": "Planner A", "kind": "planner" }
```

Response:

```json
{ "ok": true, "id": "agent_x", "token": "..." }
```

curl:

```bash
curl -X POST http://localhost:8787/api/agent/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Planner A","kind":"planner"}'
```

### Create Task

POST /api/task/create

Auth: Bearer token required.

Request:

```json
{ "title": "Draft docs", "description": "...", "depends_on": ["task_123"] }
```

Response:

```json
{ "ok": true, "id": "task_..." }
```

curl:

```bash
curl -X POST http://localhost:8787/api/task/create \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"title":"Draft docs"}'
```

### List Tasks

GET /api/task/list

Public for now.

Response: array of tasks.

### Policy Check

POST /api/policy/check

Auth: Bearer token required.

Request:

```json
{ "actor": "architect", "changedPaths": ["docs/file.md"] }
```

Response:

```json
{ "allow": true, "reasons": [] }
```

curl:

```bash
curl -X POST http://localhost:8787/api/policy/check \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"actor":"architect","changedPaths":["docs/file.md"]}'
```

### Create PR

POST /api/pr/create

Auth: Bearer token required. Applies policy check on provided file paths.

Request:

```json
{
  "task_id": "task_abc",
  "title": "Update docs",
  "body": "PR body",
  "files": [{ "path": "docs/x.md", "content": "# x" }]
}
```

Response (local fallback):

```json
{ "ok": true, "mode": "local", "artifact": "/abs/path/to/PR-task_abc.json" }
```

Response (GitHub):

```json
{ "ok": true, "mode": "github", "url": "https://github.com/.../pull/123" }
```

### Worker Protocol

The worker protocol enables agents to claim tasks and report execution progress.

#### Claim Task

POST /api/task/claim

Auth: Bearer token required.

Request:

```json
{}
```

Response (task available):

```json
{
  "task_id": "task_abc123",
  "title": "Implement feature X"
}
```

Response (no tasks available):

```json
{
  "error": "no_available_tasks"
}
```

curl:

```bash
curl -X POST http://localhost:8787/api/task/claim \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

#### Report Task Run

POST /api/task/run

Auth: Bearer token required.

Request:

```json
{
  "task_id": "task_abc123",
  "status": "in_progress",
  "notes": "Started implementation, working on core logic"
}
```

Response:

```json
{
  "ok": true
}
```

curl:

```bash
curl -X POST http://localhost:8787/api/task/run \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"task_id":"task_abc123","status":"in_progress","notes":"Starting work"}'
```

#### Get Task Status

GET /api/task/status?task_id=<id>

Public endpoint.

Response:

```json
{
  "id": "task_abc123",
  "status": "claimed"
}
```

Response (not found):

```json
{
  "ok": false,
  "error": "not_found"
}
```

curl:

```bash
curl -X GET "http://localhost:8787/api/task/status?task_id=task_abc123" \
  -H 'Authorization: Bearer TOKEN'
```

### Context Briefing

The context briefing endpoint provides comprehensive task context for agents.

#### Get Task Brief

GET /api/context/brief?task_id=<id>

Public endpoint.

Response:

```json
{
  "task": {
    "id": "task_abc123",
    "title": "Implement feature X",
    "acceptance": [
      "Implements: Add new API endpoint for user management",
      "Depends on: RFC-456"
    ]
  },
  "repo": {
    "owner": "InterCooperative-Network",
    "repo": "icn-mcp",
    "paths": ["mcp-server/src/**", "mcp-server/test/**"]
  },
  "starter_files": [
    {
      "path": "mcp-server/src/api.ts",
      "hint": "Register endpoints and handlers"
    },
    {
      "path": "mcp-server/src/db.ts",
      "hint": "Add DB helpers and migrations as needed"
    }
  ],
  "policy": {
    "caps_required": [],
    "write_scopes": ["mcp-server/**", "docs/**"]
  },
  "steps": [
    "Read existing API and DB helpers",
    "Add/update migrations and types",
    "Implement endpoints and tests",
    "Verify metrics and docs"
  ],
  "conventions": {
    "commit_format": "feat(scope): message",
    "test_patterns": ["mcp-server/test/**/*.test.ts"]
  }
}
```

Response (not found):

```json
{
  "ok": false,
  "error": "not_found"
}
```

curl:

```bash
curl -X GET "http://localhost:8787/api/context/brief?task_id=task_abc123" \
  -H 'Authorization: Bearer TOKEN'
```

### Metrics

GET /metrics

Public Prometheus metrics including:

- icn_mcp_tasks_total
- icn_mcp_policy_denies_total
- icn_mcp_pr_creates_total{mode="local|github"}
- icn_mcp_agents_total

Also includes default process metrics.


