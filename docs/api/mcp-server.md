## MCP Server API Extensions (v0.2)

### Complete API Route Reference

| Route | Method | Auth Required | Request Schema | Response Schema | Description |
|-------|--------|---------------|----------------|-----------------|-------------|
| `/healthz` | GET | No | None | `{"ok": true}` | Health check endpoint |
| `/metrics` | GET | No | None | Prometheus metrics | Metrics in Prometheus format |
| `/dashboard` | GET | No | None | HTML | Metrics dashboard |
| `/api/agent/register` | POST | Bootstrap only* | `{"name": string, "kind": "planner\|architect\|reviewer\|ops", "version"?: string}` | `{"ok": true, "id": string, "token": string}` | Register new agent |
| `/api/agent/refresh` | POST | Bearer required | `{}` | `{"ok": true, "token": string}` | Refresh agent token |
| `/api/task/create` | POST | Bearer required | `{"title": string, "description"?: string, "created_by"?: string, "depends_on"?: string[]}` | `{"ok": true, "id": string}` | Create new task |
| `/api/task/list` | GET | No | None | `Array<TaskRow>` | List all tasks |
| `/api/task/claim` | POST | Bearer required | `{}` | `{"task_id": string, "title": string}` or `{"error": string}` | Claim available task |
| `/api/task/run` | POST | Bearer required | `{"task_id": string, "status": "claimed\|in_progress\|completed\|failed", "notes"?: string}` | `{"ok": true}` | Report task execution |
| `/api/task/status` | GET | No | Query: `task_id` | `{"id": string, "status": string}` | Get task status |
| `/api/policy/check` | POST | Bearer required | `{"actor": string, "changedPaths": string[]}` | `{"allow": boolean, "reasons": string[]}` | Check policy compliance |
| `/api/pr/create` | POST | Bearer required | `{"task_id": string, "title": string, "body": string, "files": Array<{"path": string, "content": string}>}` | `{"ok": true, "mode": "local\|github", ...}` | Create pull request |
| `/api/gh/issue/create` | POST | Bearer required | `{"title": string, "body"?: string, "labels"?: string[]}` | `{"ok": true, ...}` | Create GitHub issue |
| `/api/context/brief` | GET | No | Query: `task_id` | `TaskBrief` object | Get task context briefing |
| `/api/webhooks/github` | POST | HMAC signature | GitHub webhook payload | `{"ok": true}` | GitHub webhook endpoint |

\* Bootstrap only: First agent registration requires no auth; subsequent registrations require Bearer token.

### Auth Requirements

- **No Auth**: Public endpoints accessible without authentication
- **Bearer required**: Requires `Authorization: Bearer <token>` header
- **Bootstrap only**: First registration allowed without auth; subsequent require Bearer token
- **HMAC signature**: Requires valid `X-Hub-Signature-256` header with WEBHOOK_SECRET

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GITHUB_OWNER` | `InterCooperative-Network` | GitHub repository owner |
| `GITHUB_REPO` | `icn-mcp` | GitHub repository name |
| `GITHUB_DEFAULT_BRANCH` | `main` | Default branch for PRs |
| `GITHUB_TOKEN` | - | GitHub API token for PR creation |
| `WEBHOOK_SECRET` | - | Secret for GitHub webhook verification |
| `MCP_DB_PATH` | `../var/icn-mcp.sqlite` | Database file path |
| `PORT` | `8787` | Server port |

### Webhooks

GitHub webhook events are automatically linked to tasks when the issue/PR body contains:
```
Task-ID: task_abc123
```

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

**Security**: Tokens expire after 24 hours and must be refreshed using `/api/agent/refresh`.

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

### Refresh Token

POST /api/agent/refresh

Auth: Bearer token required. Extends token expiration by 24 hours.

Request:

```json
{}
```

Response:

```json
{ "ok": true, "token": "new_token_..." }
```

curl:

```bash
curl -X POST http://localhost:8787/api/agent/refresh \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{}'
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

**Security**: All worker operations include policy checks based on agent kind and simulated file paths.

#### Claim Task

POST /api/task/claim

Auth: Bearer token required. Policy checks enforce agent permissions.

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

Response (policy denied):

```json
{
  "error": "policy_denied",
  "reasons": ["path docs/x.md not allowed for actor ops"]
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

Auth: Bearer token required. Policy checks enforce agent permissions.

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

Response (policy denied):

```json
{
  "ok": false,
  "error": "policy_denied",
  "reasons": ["path src/generated/x.ts not allowed for actor planner"]
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


