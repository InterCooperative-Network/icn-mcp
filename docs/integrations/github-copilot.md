# Using ICN MCP with GitHub Copilot

This document describes how to integrate the ICN Model Context Protocol (MCP) server with GitHub Copilot to provide domain-specific tools and context for ICN development.

## Overview

The ICN MCP server exposes key tools and resources that provide GitHub Copilot with ICN-specific domain knowledge:

### Tools

- **icn_get_architecture**: Retrieve ICN architecture and protocol documentation
- **icn_get_invariants**: List system invariants from the ICN catalog
- **icn_check_policy**: Validate changes against ICN policies
- **icn_get_task_context**: Get full task briefings with requirements and constraints
- **icn_workflow**: Orchestrate multiple tools to produce actionable plans from intents
- **icn_display_tools**: Display available tools with descriptions, categories, and risk levels for transparency
- **icn_request_consent**: Request user consent before executing potentially impactful actions
- **icn_report_progress**: Report execution progress and provide status updates for transparency

### Resources

The MCP server also exposes important ICN context through the resources capability:

- **Documentation**: Architecture and invariants docs with URIs like `icn://docs/architecture/overview.md`
- **Policy Rules**: Access to policy configuration at `icn://policy/rules.json`
- **CODEOWNERS**: Repository ownership information at `icn://CODEOWNERS`
- **Logs**: Recent system logs at `icn://logs/recent` (placeholder)

These resources allow GitHub Copilot to directly access and reference ICN documentation, policies, and configuration when providing assistance.

## Setup

### 1. Start the MCP Server

First, ensure the ICN MCP server is built and ready:

```bash
npm run build
npm run mcp-server
```

The server will start in stdio mode and display:
```
ICN MCP Server running on stdio
```

### 2. Configure GitHub Copilot

Configure the MCP server in your repository settings or development environment:

```json
{
  "mcpServers": {
    "icn": {
      "type": "stdio",
      "command": "npm",
      "args": ["run", "mcp-server"],
      "tools": ["*"]
    }
  }
}
```

### 3. Environment Variables (Optional)

The MCP server supports configuration via environment variables:

**Path Configuration:**
- `REPO_ROOT`: Override the detected repository root path
- `DOCS_ROOT`: Override the documentation directory (default: `{REPO_ROOT}/docs`)
- `POLICY_RULES_PATH`: Override policy rules file location (default: `{REPO_ROOT}/mcp-server/policy.rules.json`)
- `CODEOWNERS_PATH`: Override CODEOWNERS file location (default: `{REPO_ROOT}/CODEOWNERS`)

**Database Configuration:**
- `MCP_DB_DIR`: Override database directory (default: `{REPO_ROOT}/var`)
- `MCP_DB_PATH`: Override specific database file path (default: `{MCP_DB_DIR}/icn-mcp.sqlite`)
- `MCP_MIGRATIONS_DIR`: Override migrations directory (default: `{REPO_ROOT}/db/migrations`)

**Example .env configuration:**
```bash
REPO_ROOT=/path/to/icn-mcp
DOCS_ROOT=/path/to/icn-mcp/docs
MCP_DB_DIR=/path/to/icn-mcp/var
POLICY_RULES_PATH=/path/to/icn-mcp/mcp-server/policy.rules.json

# Consent system configuration
ICN_CONSENT_REQUIRE_ALL=false
ICN_CONSENT_TIMEOUT=300
ICN_CONSENT_ALWAYS_REQUIRE="icn_write_patch,icn_run_tests"
ICN_CONSENT_LOG=true
```

## User Interface Features

### Tool Discovery

Use `icn_display_tools` to discover available tools:

```typescript
// Display all tools
const tools = await icn_display_tools();

// Display tools by category
const devTools = await icn_display_tools({ category: "development" });
```

**Response format:**
```json
{
  "tools": [
    {
      "name": "icn_write_patch",
      "description": "Write or patch a file with policy enforcement",
      "category": "development",
      "riskLevel": "high",
      "requiresConsent": true,
      "example": "icn_write_patch({ files: [\"src/example.ts\"], content: \"...\" })"
    }
  ],
  "totalCount": 26,
  "categories": ["architecture", "development", "governance"]
}
```

### Consent Requests

Use `icn_request_consent` for transparent user approval:

```typescript
const consent = await icn_request_consent({
  toolName: "icn_write_patch",
  context: "Adding new MCP tool implementation"
});
```

**GitHub Copilot Integration:**
- Consent prompts display as formatted chat messages
- Risk levels shown with color-coded emojis (🟢🟡🔴)
- Timeout warnings clearly communicated
- User can respond with "yes", "no", or additional instructions

### Progress Reporting

Use `icn_report_progress` for real-time execution updates:

```typescript
await icn_report_progress({
  toolName: "icn_run_tests",
  phase: "unit-tests",
  progress: 75,
  message: "Running integration tests",
  status: "info"
});
```

**Client Rendering Guidelines:**

**Text-Only Rendering:**
```
## Progress Update ℹ️

**Tool:** icn_run_tests
**Phase:** unit-tests
**Progress:** [███████░░░] 75%
**Status:** Running integration tests
**Time:** 2025-01-15T10:30:00.000Z
```

**Rich UI Rendering (if supported):**
- Progress bars: Use actual progress bar components when available
- Status icons: Render emoji status indicators (✅⚠️❌ℹ️)
- Expandable details: Make additional details collapsible
- Real-time updates: Update progress in-place when possible

**Error Handling:**
```typescript
await icn_report_progress({
  toolName: "icn_run_tests",
  progress: 45,
  message: "Test failure detected",
  status: "error",
  error: {
    code: "TEST_FAILURE",
    message: "Integration tests failed in auth module",
    recoverable: true
  }
});
```
# Override paths for development
DOCS_ROOT=/custom/docs/path
MCP_DB_DIR=/tmp/icn-mcp-dev
POLICY_RULES_PATH=/custom/policies/rules.json
```

### 4. Verify Connection

Once configured, GitHub Copilot can use the ICN tools to understand your development context and provide more relevant suggestions.

## Available Tools

### icn_get_architecture

Retrieves ICN architecture and protocol documentation, optionally filtered by task relevance.

**Parameters:**
- `task` (optional): Task description to filter relevant sections

**Response:**
```json
{
  "sections": [
    {
      "title": "Architecture: overview",
      "path": "docs/architecture/00-overview.md",
      "content": "ICN MCP acts as HQ for agents..."
    }
  ]
}
```

### icn_get_invariants

Lists all system invariants from the ICN invariants catalog.

**Parameters:** None

**Response:**
```json
{
  "invariants": [
    {
      "id": "INV-MCP-0001",
      "statement": "no_merge_without_checks",
      "evidence": "TODO: Formalize assert conditions and evidence.",
      "checks": []
    }
  ]
}
```

### icn_check_policy

Validates a changeset against ICN policies and returns approval status.

**Parameters:**
- `changeset`: Array of file paths that would be changed
- `actor` (optional): The actor making the changes

**Response:**
```json
{
  "allow": false,
  "reasons": [
    "path .github/workflows/test.yml not allowed for actor architect"
  ],
  "suggestions": [
    "Consider requesting permission or modifying files within your authorized paths"
  ]
}
```

### icn_get_task_context

Retrieves full task briefing including requirements, constraints, and guidance.

**Parameters:**
- `taskId`: The ID of the task to get context for

**Response:**
```json
{
  "task": {
    "id": "test-task",
    "title": "Task: test-task",
    "acceptance": ["Implements the requirements..."]
  },
  "repo": {
    "owner": "InterCooperative-Network",
    "repo": "icn-mcp",
    "paths": ["mcp-server/src/**", "mcp-node/src/**"]
  },
  "policy": {
    "caps_required": [],
    "write_scopes": ["mcp-server/**", "mcp-node/**"]
  },
  "steps": ["Review ICN architecture...", "Implement changes..."],
  "conventions": {
    "commit_format": "feat(scope): message",
    "test_patterns": ["mcp-server/test/**/*.test.ts"]
  }
}
```

### icn_workflow

Orchestrates multiple MCP tools to produce actionable plans from high-level intents. This tool sequences other tools like `icn_get_architecture`, `icn_get_invariants`, `icn_check_policy` to create comprehensive implementation plans.

**Parameters:**
- `intent` (required): The high-level intent or goal that needs to be planned and executed
- `context` (optional): Additional context such as task IDs, file paths, or domain-specific information
- `constraints` (optional): Array of constraints or limitations to consider
- `actor` (optional): The actor (user/agent) who will execute the plan, used for policy checks

**Response:**
```json
{
  "plan": {
    "id": "orch_1234567890_abc123",
    "intent": "Implement new MCP tool for data processing",
    "steps": [
      {
        "tool": "icn_get_architecture",
        "params": { "task": "Implement new MCP tool for data processing" },
        "description": "Gather relevant architecture documentation and patterns"
      },
      {
        "tool": "icn_get_invariants",
        "params": {},
        "description": "Retrieve system invariants and constraints",
        "dependsOn": ["icn_get_architecture"]
      },
      {
        "tool": "icn_check_policy",
        "params": { "changeset": ["mcp-node/src/"], "actor": "architect" },
        "description": "Validate proposed changes against ICN policies",
        "dependsOn": ["icn_get_architecture", "icn_get_invariants"]
      },
      {
        "tool": "icn_suggest_approach",
        "params": { 
          "task_description": "Implement new MCP tool for data processing",
          "context": null,
          "constraints": []
        },
        "description": "Generate implementation approach and recommendations",
        "dependsOn": ["icn_get_architecture", "icn_get_invariants", "icn_check_policy"]
      }
    ],
    "expectedDuration": "1-2 minutes",
    "complexity": "medium"
  },
  "execution": {
    "stepResults": {
      "icn_get_architecture": { "sections": [...] },
      "icn_get_invariants": { "invariants": [...] },
      "icn_check_policy": { "allow": true, "reasons": [] },
      "icn_suggest_approach": { "approach": {...}, "playbooks": [...] }
    },
    "currentStep": 4,
    "status": "completed",
    "startedAt": "2024-01-15T10:30:00Z",
    "completedAt": "2024-01-15T10:31:30Z"
  }
}
```

**Intelligence Features:**
- **Pattern Recognition**: Analyzes intent keywords to determine which tools are needed
- **Dependency Management**: Automatically establishes proper execution order for tools
- **File Path Extraction**: Identifies likely modified files from intent descriptions for policy checks
- **Complexity Assessment**: Categorizes workflows as low/medium/high complexity with time estimates
- **Context Integration**: Uses task context when available to enhance planning accuracy

## Resources

The ICN MCP server also exposes resources through the MCP resources capability, allowing direct access to important ICN context:

### Available Resources

- **`icn://docs/architecture/`**: ICN architecture documentation files
  - Example: `icn://docs/architecture/00-overview.md`
  - Content: Architecture overviews, component designs, system flows
  - MIME Type: `text/markdown`

- **`icn://docs/invariants/`**: System invariants documentation
  - Example: `icn://docs/invariants/catalog.md`
  - Content: System constraints, validation rules, compliance requirements
  - MIME Type: `text/markdown`

- **`icn://policy/rules.json`**: Policy configuration
  - Content: Access control rules, path capabilities, review requirements
  - MIME Type: `application/json`

- **`icn://CODEOWNERS`**: Repository ownership configuration
  - Content: Code ownership mappings for review assignments
  - MIME Type: `text/plain`

- **`icn://logs/recent`**: Recent system logs
  - Content: Debugging information, task execution logs
  - MIME Type: `text/plain`

### Using Resources

GitHub Copilot can access these resources directly through the MCP resources protocol to:

- **Reference documentation**: Get the latest architecture docs to understand system design
- **Check policies**: Review access control rules before suggesting changes
- **Understand ownership**: Reference CODEOWNERS for appropriate reviewers
- **Debug issues**: Access recent logs for troubleshooting context

The resources provide GitHub Copilot with direct access to the most current ICN documentation and configuration, ensuring suggestions are aligned with project policies and architecture.

## Usage Examples

### Getting Architecture Context

When working on agent-related features, Copilot can request:

```
icn_get_architecture(task: "implementing new agent capabilities")
```

This returns relevant architecture documentation filtered for agent-related content.

### Validating Changes

Before suggesting code changes, Copilot can check policies:

```
icn_check_policy({
  changeset: ["mcp-server/src/new-feature.ts", "docs/api.md"],
  actor: "architect"
})
```

This validates whether the proposed changes are allowed under ICN policies.

### Understanding Constraints

For any development task, Copilot can get the full context:

```
icn_get_task_context({taskId: "TASK-123"})
```

This provides comprehensive guidance including coding conventions, test patterns, and policy constraints.

### Discovering Available Tools

To see all available tools with their descriptions and risk levels:

```
icn_display_tools()
```

This returns categorized tools with risk assessments and usage information, helping users understand what capabilities are available.

### Requesting User Consent

For tools that require user permission:

```
icn_request_consent({
  toolName: "icn_write_patch",
  toolArgs: { files: ["src/new-feature.ts"] },
  context: "Adding new MCP tool functionality"
})
```

This displays a formatted consent prompt with risk assessment and impact details, ensuring user transparency and control.

### Tracking Progress

For long-running operations:

```
icn_report_progress({
  toolName: "icn_run_tests", 
  phase: "execution",
  progress: 60,
  message: "Running integration tests..."
})
```

This provides real-time progress updates with visual indicators, keeping users informed during tool execution.

### Orchestrating Complex Planning

For complex development tasks that require multiple tools, Copilot can use workflow orchestration:

```
icn_workflow({
  intent: "Implement new MCP tool for workflow management", 
  actor: "architect",
  constraints: ["maintain backward compatibility", "follow existing patterns"]
})
```

This automatically sequences multiple tools:
1. Gets relevant architecture documentation 
2. Retrieves system invariants and constraints
3. Checks policy compliance for likely file changes
4. Suggests implementation approach based on all gathered context

### Planning from High-Level Intent

Copilot can convert high-level intents into actionable plans:

```
icn_workflow({
  intent: "Add GitHub integration with webhook support",
  context: "mcp-server workspace", 
  actor: "ops"
})
```

The orchestration intelligently determines which tools to call based on keywords in the intent and produces a comprehensive execution plan with dependencies properly ordered.

## Development Notes

- All tool responses are structured JSON for programmatic consumption
- File paths are included in responses so Copilot knows where to look for more details
- The MCP server operates independently from the existing HTTP API
- Tools are designed to be stateless and fast-responding
- Error handling provides meaningful feedback for debugging

## Troubleshooting

### Server Won't Start
- Ensure all dependencies are installed: `npm install`
- Verify the build completed successfully: `npm run build`
- Check for TypeScript errors in the build output

### Tools Return Errors
- Verify file paths exist (docs/architecture, docs/protocols, etc.)
- Check that policy.rules.json is accessible
- Ensure proper permissions for file system access

### Copilot Can't Connect
- Verify the MCP server configuration is correct
- Check that the stdio transport is working properly
- Review Copilot logs for connection errors

## Architecture

The ICN MCP server is implemented as a separate `mcp-node` workspace that:

- Uses the @modelcontextprotocol/sdk for protocol compliance
- Implements stdio transport for GitHub Copilot integration
- Provides self-contained tool implementations
- Maintains compatibility with existing ICN components
- Follows ICN conventions for error handling and logging


