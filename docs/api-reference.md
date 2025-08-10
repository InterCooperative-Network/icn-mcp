# ICN MCP API Reference

The ICN MCP (Model Context Protocol) server provides a REST API for managing AI agents, tasks, and GitHub integration with policy enforcement.

## Base URL

The server runs on `http://localhost:8787` by default. The API prefix is `/api`.

## Authentication

Most endpoints require Bearer token authentication. The token is obtained when registering an agent.

```
Authorization: Bearer <token>
```

## Endpoints

### Health Check

#### GET /healthz

Returns server health status.

**Response:**
```json
{
  "ok": true
}
```

### Agent Management

#### POST /api/agent/register

Register a new agent and obtain an authentication token.

**Request Body:**
```json
{
  "name": "string",
  "kind": "planner" | "architect" | "reviewer" | "ops",
  "version": "string" (optional)
}
```

**Response:**
```json
{
  "ok": true,
  "id": "agent_abc123",
  "token": "hex_token_string"
}
```

**Notes:**
- First agent registration doesn't require authentication
- Subsequent registrations require existing agent token

### Task Management

#### POST /api/task/create

Create a new task.

**Authentication:** Required

**Request Body:**
```json
{
  "title": "string",
  "description": "string" (optional),
  "created_by": "string" (optional),
  "depends_on": ["task_id1", "task_id2"] (optional)
}
```

**Response:**
```json
{
  "ok": true,
  "id": "task_abc123"
}
```

#### GET /api/task/list

List all tasks.

**Authentication:** Not required

**Response:**
```json
[
  {
    "id": "task_abc123",
    "title": "Task title",
    "description": "Task description",
    "status": "open",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

### Policy Engine

#### POST /api/policy/check

Check if an action is allowed by policy.

**Authentication:** Required

**Request Body:**
```json
{
  "actor": "string",
  "changedPaths": ["path1", "path2"]
}
```

**Response:**
```json
{
  "allow": true,
  "reasons": []
}
```

Or when denied:
```json
{
  "allow": false,
  "reasons": ["reason1", "reason2"]
}
```

### GitHub Integration

#### POST /api/pr/create

Create a pull request (local or GitHub).

**Authentication:** Required

**Request Body:**
```json
{
  "task_id": "task_abc123",
  "title": "PR title",
  "body": "PR description",
  "files": [
    {
      "path": "file/path.ts",
      "content": "file content"
    }
  ]
}
```

**Response (GitHub mode):**
```json
{
  "ok": true,
  "mode": "github",
  "url": "https://github.com/owner/repo/pull/123"
}
```

**Response (Local mode):**
```json
{
  "ok": true,
  "mode": "local",
  "artifact": "/path/to/PR-task_abc123.json"
}
```

#### POST /api/gh/issue/create

Create a GitHub issue.

**Authentication:** Required

**Request Body:**
```json
{
  "title": "Issue title",
  "body": "Issue description" (optional),
  "labels": ["label1", "label2"] (optional)
}
```

**Response:**
```json
{
  "ok": true,
  "mode": "github",
  "url": "https://github.com/owner/repo/issues/123"
}
```

### Context & Briefing

#### GET /api/context/brief?task_id=<id>

Get contextual brief for a task.

**Authentication:** Not required

**Query Parameters:**
- `task_id`: The task ID to get context for

**Response:**
```json
{
  "task": {
    "id": "task_abc123",
    "title": "Task title",
    "description": "Task description"
  },
  "artifacts": [],
  "deps": []
}
```

### Worker Protocol

#### POST /api/task/claim

Claim a task for execution.

**Authentication:** Required

#### POST /api/task/run

Execute a claimed task.

**Authentication:** Required

#### GET /api/task/status?task_id=<id>

Get task execution status.

**Authentication:** Not required

### Webhooks

#### POST /api/webhooks/github

GitHub webhook endpoint for receiving events.

**Authentication:** Uses webhook secret validation

**Headers:**
- `X-GitHub-Event`: Event type
- `X-GitHub-Delivery`: Delivery ID
- `X-Hub-Signature-256`: Signature

### Metrics

#### GET /metrics

Prometheus-format metrics.

**Response:** Plain text Prometheus metrics

#### GET /dashboard

Basic metrics dashboard.

**Response:** HTML dashboard page

## Environment Variables

- `PORT`: Server port (default: 8787)
- `LOG_LEVEL`: Logging level (debug, info, warn, error)
- `NODE_ENV`: Environment (development, production)
- `MCP_DB_PATH`: SQLite database path
- `GITHUB_TOKEN`: GitHub API token
- `GITHUB_OWNER`: GitHub repository owner
- `GITHUB_REPO`: GitHub repository name
- `GITHUB_BASE`: Base branch (default: main)
- `WEBHOOK_SECRET`: GitHub webhook secret

## Error Responses

All endpoints may return error responses in the format:

```json
{
  "ok": false,
  "error": "error_code",
  "issues": [] // For validation errors
}
```

Common error codes:
- `unauthorized`: Missing or invalid authentication
- `validation_error`: Request validation failed
- `internal_error`: Server error
- `not_found`: Resource not found

## Request IDs

All requests receive a unique request ID in the `x-request-id` header and in structured logs for tracing.