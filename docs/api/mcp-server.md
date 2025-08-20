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
| `/api/admin/stats` | GET | Maintainer required | None | `{"ok": true, "stats": {...}}` | Get system statistics |
| `/api/admin/agents/cleanup` | POST | Maintainer required | `{}` | `{"ok": true, "deletedCount": number}` | Clean up expired agent tokens |
| `/api/context/brief` | GET | No | Query: `task_id` | `TaskBrief` object | Get task context briefing |
| `/api/webhooks/github` | POST | HMAC signature | GitHub webhook payload | `{"ok": true}` | GitHub webhook endpoint |

\* Bootstrap only: First agent registration requires no auth; subsequent registrations require Bearer token.

### Auth Requirements

- **No Auth**: Public endpoints accessible without authentication
- **Bearer required**: Requires `Authorization: Bearer <token>` header
- **Bootstrap only**: First registration allowed without auth; subsequent require Bearer token
- **Maintainer required**: Requires maintainer token (admin or regular maintainer)
- **HMAC signature**: Requires valid `X-Hub-Signature-256` header with WEBHOOK_SECRET

### Security Features

The MCP server implements comprehensive security including:

- **Bearer Token Authentication**: Supports both agent tokens (dynamic, database-stored) and maintainer tokens (environment-configured)
- **Role-Based Access Control (RBAC)**: Distinguishes between agent and maintainer roles with different permissions
- **Rate Limiting**: Per-IP and per-token rate limits with higher limits for maintainers
- **Audit Logging**: Comprehensive logging of authentication events, failures, and admin actions

### Token Management and Expiration

#### Agent Tokens
- **Dynamic Creation**: Agent tokens are generated during registration and stored in the database
- **Expiration**: Agent tokens automatically expire after 24 hours
- **Refresh**: Expired tokens can be renewed using the `/api/agent/refresh` endpoint with the current (potentially expired) token
- **Storage**: Tokens are stored hashed in the database for security
- **Grace Period**: Expired tokens are immediately invalid with no grace window

#### Maintainer Tokens
- **Environment Configuration**: Maintainer tokens are configured via environment variables
- **No Expiration**: Maintainer tokens do not expire automatically
- **Two Types**: 
  - `MAINTAINER_ADMIN_TOKEN`: Single admin token with full privileges
  - `MAINTAINER_TOKENS`: Comma-separated list of regular maintainer tokens
- **Rotation**: Tokens should be rotated manually by updating environment variables and restarting the server

#### Token Security Best Practices
- **Entropy**: Maintainer tokens should have high entropy (≥32 characters)
- **Storage**: Agent tokens are stored hashed in the database (not plain text)
- **Logging**: All authentication attempts are logged with IP addresses and user agents
- **Rate Limiting**: Tokens are subject to rate limiting (higher limits for maintainers)

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
| `MAINTAINER_ADMIN_TOKEN` | - | Admin maintainer token (highest privileges) |
| `MAINTAINER_TOKENS` | - | Comma-separated list of regular maintainer tokens |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window in milliseconds |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window for agents/IPs |
| `RATE_LIMIT_MAX_REQUESTS_MAINTAINER` | `1000` | Max requests per window for maintainers |

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

## MCP Resources

The MCP server provides resources accessible via the Model Context Protocol for GitHub Copilot integration.

### Architecture Documentation

Resources prefixed with `icn://docs/architecture/` provide access to ICN architecture documentation:

- `icn://docs/architecture/event-sourcing.md` - Event sourcing patterns and implementation
- `icn://docs/architecture/coordination-credits.md` - Coordination Credits system design
- `icn://docs/architecture/governance.md` - Democratic governance structures
- `icn://docs/architecture/mcp-integration.md` - Model Context Protocol integration patterns

Example:
```
URI: icn://docs/architecture/event-sourcing.md
MIME Type: text/markdown
Description: ICN architecture documentation for event sourcing patterns
```

### Invariants Documentation

Resources prefixed with `icn://docs/invariants/` provide access to system invariants and constraints:

- `icn://docs/invariants/core.md` - Core ICN system invariants
- `icn://docs/invariants/governance.md` - Governance-related invariants
- `icn://docs/invariants/credits.md` - Coordination Credits invariants

Example:
```
URI: icn://docs/invariants/core.md
MIME Type: text/markdown
Description: ICN system invariants defining core constraints and requirements
```

### Policy Rules

The policy configuration is available as a resource:

- `icn://policy/rules.json` - ICN policy rules for access control and permissions

Example:
```
URI: icn://policy/rules.json
MIME Type: application/json
Description: ICN policy rules configuration for access control and code review requirements
```

## MCP Prompts

The MCP server provides structured prompts for various ICN development and governance tasks.

### Code Review Prompt

**Name:** `code-review`
**Category:** review
**Description:** Review code changes with ICN policy and invariants in mind

**Arguments:**
- `changes` (required): The code changes to review (diff format)
- `files` (optional): List of files being modified
- `context` (optional): Additional context about the changes

The prompt instructs reviewers to check:
- ICN invariants compliance (event-sourced architecture, deterministic operations, democratic governance)
- Policy adherence (file permissions, actor authorization)
- Standard code quality practices

### Architecture Decision Record (ADR) Prompt

**Name:** `adr-template`
**Category:** documentation
**Description:** Generate Architecture Decision Record following ICN standards

**Arguments:**
- `decision` (required): The architectural decision being documented
- `context` (optional): Background and context for the decision
- `consequences` (optional): Expected consequences and trade-offs

### Release Notes Prompt

**Name:** `release-notes`
**Category:** workflow
**Description:** Generate release notes from changes and commits

**Arguments:**
- `version` (required): Version number for the release
- `changes` (optional): List of changes and commits
- `highlights` (optional): Key features or improvements to highlight

### Governance Proposal Prompt

**Name:** `governance-proposal`
**Category:** governance
**Description:** Structure governance proposals for ICN democratic processes

**Arguments:**
- `proposal` (required): The governance proposal content
- `type` (optional): Type of proposal (policy, technical, process)
- `stakeholders` (optional): Affected stakeholders and communities

### Consent and UI Prompts

The system includes specialized prompts for user consent and progress tracking:

- `tool_consent_request` - Request user consent for tool execution
- `tool_progress_update` - Provide progress updates during long-running operations
- `tools_display` - Display available tools and their capabilities
- `consent_summary` - Summarize consent requirements and permissions
- `progress_summary` - Summarize overall progress across multiple operations

## Workflow API

The workflow API enables orchestration of multi-step processes and template-based automation.

### List Workflow Templates

GET /workflow/templates

Public endpoint to list available workflow templates.

Response:
```json
{
  "ok": true,
  "data": {
    "templates": [
      {
        "id": "add-mcp-tool",
        "name": "Add MCP Tool",
        "description": "Workflow for adding new MCP tools to the system",
        "steps": [
          {
            "id": "create-tool-file",
            "name": "Create Tool Implementation",
            "description": "Create the tool implementation file"
          },
          {
            "id": "add-manifest",
            "name": "Update Tool Manifest",
            "description": "Add tool to the manifest"
          }
        ]
      }
    ],
    "categories": ["development", "governance", "maintenance"],
    "tags": ["mcp", "tools", "automation"]
  },
  "meta": { "version": "v1" }
}
```

### Start Workflow

POST /workflow/start

Auth: Bearer token required.

Request:
```json
{
  "templateId": "add-mcp-tool",
  "initialData": {
    "toolName": "icn_new_feature",
    "description": "Implement new feature functionality"
  },
  "sourceRequestId": "req_abc123"
}
```

Response:
```json
{
  "ok": true,
  "data": {
    "workflowId": "wf_xyz789",
    "state": {
      "id": "wf_xyz789",
      "templateId": "add-mcp-tool",
      "status": "active",
      "currentStep": "create-tool-file",
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "nextStep": {
      "step": {
        "id": "create-tool-file",
        "name": "Create Tool Implementation",
        "description": "Create the tool implementation file",
        "inputs": ["toolName", "description"]
      },
      "availableActions": ["complete_step", "create_checkpoint", "pause_workflow"]
    }
  },
  "meta": { "workflowId": "wf_xyz789", "version": "v1" }
}
```

### Get Workflow State

GET /workflow/:workflowId

Auth: Bearer token required.

Response:
```json
{
  "ok": true,
  "data": {
    "id": "wf_xyz789",
    "templateId": "add-mcp-tool",
    "status": "active",
    "currentStep": "create-tool-file",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:35:00Z",
    "data": {
      "toolName": "icn_new_feature",
      "description": "Implement new feature functionality"
    }
  },
  "meta": { "version": "v1" }
}
```

### Get Next Step

GET /workflow/:workflowId/next-step

Auth: Bearer token required.

Response:
```json
{
  "ok": true,
  "data": {
    "step": {
      "id": "add-manifest",
      "name": "Update Tool Manifest",
      "description": "Add tool to the manifest",
      "inputs": ["manifestPath"],
      "outputs": ["updatedManifest"]
    },
    "availableActions": ["complete_step", "create_checkpoint", "pause_workflow"]
  },
  "meta": { "workflowId": "wf_xyz789", "version": "v1" }
}
```

### Create Checkpoint

POST /workflow/checkpoint

Auth: Bearer token required.

Request:
```json
{
  "workflowId": "wf_xyz789",
  "stepId": "create-tool-file",
  "data": {
    "filePath": "mcp-node/src/tools/icn_new_feature.ts",
    "implementationComplete": true
  },
  "notes": "Tool implementation completed and tested",
  "completeStep": true,
  "idempotencyKey": "checkpoint_123"
}
```

Response:
```json
{
  "ok": true,
  "data": {
    "checkpointId": "cp_abc456",
    "workflowId": "wf_xyz789",
    "stepId": "create-tool-file",
    "createdAt": "2024-01-15T10:45:00Z",
    "stepCompleted": true
  },
  "meta": { "version": "v1" }
}
```

### Complete Step

POST /workflow/complete-step

Auth: Bearer token required.

Request:
```json
{
  "workflowId": "wf_xyz789",
  "stepId": "add-manifest",
  "outputs": {
    "manifestPath": "mcp-node/src/manifest.ts",
    "toolsAdded": 1
  },
  "idempotencyKey": "complete_456"
}
```

### Orchestrate Workflow

POST /workflow/orchestrate

Auth: Bearer token required. Orchestrates multi-step workflows from natural language intents.

Request:
```json
{
  "intent": "Add a new MCP tool for validating ICN governance proposals",
  "context": "Need to ensure governance proposals follow ICN democratic principles",
  "constraints": [
    "Must integrate with existing policy checking",
    "Should validate against ICN invariants"
  ],
  "actor": "architect"
}
```

Response:
```json
{
  "ok": true,
  "data": {
    "plan": {
      "id": "plan_abc123",
      "intent": "Add a new MCP tool for validating ICN governance proposals",
      "steps": [
        {
          "id": "analyze_requirements",
          "tool": "icn_extract_principles",
          "params": {
            "text": "Add a new MCP tool for validating ICN governance proposals"
          }
        },
        {
          "id": "suggest_approach",
          "tool": "icn_suggest_approach",
          "params": {
            "task_description": "Implement governance proposal validation tool",
            "constraints": ["Must integrate with existing policy checking"]
          }
        }
      ],
      "expectedDuration": "2-4 hours",
      "complexity": "medium"
    },
    "results": {
      "analyze_requirements": {
        "principles": ["democratic governance", "policy compliance"],
        "requirements": ["validation logic", "integration points"]
      },
      "suggest_approach": {
        "recommended_playbooks": ["add-mcp-tool"],
        "suggested_approaches": [
          {
            "approach_name": "MCP Tool Implementation",
            "steps": ["Create tool file", "Add to manifest", "Write tests"],
            "estimated_effort": "4 hours",
            "risk_level": "low"
          }
        ]
      }
    },
    "status": "completed"
  },
  "meta": { "planId": "plan_abc123", "version": "v1" }
}
```

### Workflow Actions

POST /workflow/action

Auth: Bearer token required.

Request:
```json
{
  "workflowId": "wf_xyz789",
  "action": "pause",
  "reason": "Waiting for external review"
}
```

Response:
```json
{
  "ok": true,
  "data": {
    "workflowId": "wf_xyz789",
    "action": "pause",
    "previousStatus": "active",
    "newStatus": "paused",
    "timestamp": "2024-01-15T11:00:00Z"
  },
  "meta": { "version": "v1" }
}
```

**Available Actions:**
- `pause` - Pause an active workflow
- `resume` - Resume a paused workflow  
- `fail` - Mark workflow as failed with reason


