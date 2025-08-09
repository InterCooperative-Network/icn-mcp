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
curl -s http://localhost:8787/api/agent/register \
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
curl -s http://localhost:8787/api/task/create \
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
curl -s http://localhost:8787/api/policy/check \
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

### Metrics

GET /metrics

Public Prometheus metrics including:

- icn_mcp_tasks_total
- icn_mcp_policy_denies_total
- icn_mcp_pr_creates_total{mode="local|github"}
- icn_mcp_agents_total

Also includes default process metrics.


