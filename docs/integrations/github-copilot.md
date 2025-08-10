# Using ICN MCP with GitHub Copilot

This document describes how to integrate the ICN Model Context Protocol (MCP) server with GitHub Copilot to provide domain-specific tools and context for ICN development.

## Overview

The ICN MCP server exposes four key tools that provide GitHub Copilot with ICN-specific domain knowledge:

- **icn_get_architecture**: Retrieve ICN architecture and protocol documentation
- **icn_get_invariants**: List system invariants from the ICN catalog
- **icn_check_policy**: Validate changes against ICN policies
- **icn_get_task_context**: Get full task briefings with requirements and constraints

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

### 3. Verify Connection

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


