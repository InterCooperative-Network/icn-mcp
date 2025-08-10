# ICN MCP Agent HQ - GitHub Copilot Instructions

**ALWAYS follow these instructions first** and only fallback to additional search and context gathering if the information in these instructions is incomplete or found to be in error.

## Project Overview

ICN MCP Agent HQ is a TypeScript monorepo that orchestrates AI agents for ICN development via pull requests, operating under policy and invariants. The system includes:

- **mcp-server**: Fastify HTTP server with SQLite database and GitHub integration (port 8787)
- **mcp-node**: MCP (Model Context Protocol) SDK implementation for GitHub Copilot integration (stdio mode)
- **agent-sdk**: SDK for building AI agents  
- **agents/**: Four AI agents (architect, ops, planner, reviewer)

## Working Effectively

### Bootstrap, Build, and Test Commands

**NEVER CANCEL any build or test command** - All operations complete quickly but use appropriate timeouts to be safe.

**Setup and Dependencies:**
```bash
# Ensure Node.js v20 is installed (required - see .nvmrc)
nvm use  # or ensure node --version shows v20.x

# Install dependencies - takes ~60 seconds
npm ci  # NEVER CANCEL: Set timeout to 120+ seconds
```

**Build the entire monorepo:**
```bash
# Build all workspaces - takes ~10 seconds  
npm run build  # NEVER CANCEL: Set timeout to 60+ seconds

# Individual workspace builds (if needed):
npm run -w mcp-server build
npm run -w mcp-node build  
npm run -w agent-sdk build
```

**Run tests:**
```bash
# Run all tests - takes ~10 seconds
npm test  # NEVER CANCEL: Set timeout to 60+ seconds

# Individual workspace tests (if needed):
npm run -w mcp-server test
npm run -w mcp-node test
npm run -w agent-sdk test
```

**Lint and validation:**
```bash
# Lint code - takes ~2 seconds
npm run lint  # Set timeout to 30+ seconds

# Run ICN-specific checks - takes <1 second  
npm run check  # Set timeout to 30+ seconds
```

### Running the Services

**Start the HTTP server:**
```bash
# ALWAYS run build first
npm run build

# Start development server on port 8787
npm run -w mcp-server dev

# Server will log: "Server listening at http://0.0.0.0:8787"
# Test health endpoint: curl http://localhost:8787/healthz
# Expected response: {"ok":true}
```

**Start the MCP server (for GitHub Copilot):**
```bash
# Run in stdio mode for GitHub Copilot integration
npm run mcp-server

# Server will log: "ICN MCP Server running on stdio"
# This server provides ICN-specific tools to GitHub Copilot
```

**Run individual agents:**
```bash
# ALWAYS start with server running first
npm run -w mcp-server dev  # In one terminal

# Then run agents (using npx tsx for TypeScript execution):
npx tsx agents/planner/src/index.ts            # Creates tasks from Intent-0001
npx tsx agents/architect/src/index.ts --task <TASK_ID>  # Drafts and creates PR descriptor
npx tsx agents/ops/src/index.ts                # Operations agent
npx tsx agents/reviewer/src/index.ts           # Code review agent
```

## Validation

### Manual Validation Requirements
**ALWAYS test functionality after making changes:**

1. **Complete build and test validation:**
   ```bash
   npm run build && npm test && npm run lint && npm run check
   # Should complete without errors in ~15 seconds total
   ```

2. **Server functionality validation:**
   ```bash
   npm run -w mcp-server dev &
   sleep 3
   curl -s http://localhost:8787/healthz | grep '"ok":true' && echo "✓ HTTP server working"
   kill %1  # Stop background server
   ```

3. **MCP server validation:**
   ```bash
   timeout 10s npm run mcp-server | grep "ICN MCP Server running on stdio" && echo "✓ MCP server working"
   ```

4. **Agent integration validation:**
   ```bash
   # Start server in background, test agent connection
   npm run -w mcp-server dev >/dev/null 2>&1 &
   sleep 3
   timeout 5s npx tsx agents/planner/src/index.ts 2>&1 | head -3 | grep -q "Intent-0001\|planner created"
   echo "✓ Agent-server integration working"
   kill %1  # Stop background server
   ```

5. **Complete validation script (copy-paste for thorough testing):**
   ```bash
   echo "=== ICN-MCP Validation ==="
   npm run build && npm test && npm run lint && npm run check || exit 1
   npm run -w mcp-server dev >/dev/null 2>&1 & 
   sleep 3
   curl -s http://localhost:8787/healthz | grep '"ok":true' && echo "✓ HTTP server OK"
   timeout 3s npx tsx agents/planner/src/index.ts >/dev/null 2>&1 && echo "✓ Agents OK"
   kill %1
   timeout 10s npm run mcp-server 2>&1 | head -1 && echo "✓ MCP server OK"
   echo "=== All validations passed ==="
   ```

### CI/Build Requirements
- **ALWAYS run** `npm run lint` before committing - CI will fail on any warnings
- **ALWAYS run** `npm run check` before committing - validates spec links and invariants
- All tests must pass: `npm test`
- Build must succeed: `npm run build`

## Common Tasks and File Locations

### Key Directories and Files

**Repository Root:**
```
├── .nvmrc                    # Node v20 requirement
├── package.json              # Workspace configuration and scripts
├── eslint.config.mjs         # ESLint configuration
├── tsconfig.base.json        # TypeScript base configuration
├── CONTRIBUTING.md           # Contribution guidelines
├── .github/workflows/ci.yml  # CI pipeline (lint, test, build)
└── docs/                     # Documentation
    ├── integrations/github-copilot.md  # Copilot integration guide
    ├── api/                  # API documentation
    ├── architecture/         # Architecture docs
    └── policy/               # Policy documentation
```

**Core Workspaces:**
```
├── mcp-server/              # HTTP server workspace
│   ├── src/index.ts         # Main server entry point
│   ├── policy.rules.json    # Policy rules configuration
│   └── test/                # Server tests
├── mcp-node/                # MCP SDK workspace  
│   ├── src/server.ts        # MCP server for Copilot
│   ├── src/tools/           # MCP tools (icn_get_architecture, etc.)
│   └── test/                # MCP tests
├── agent-sdk/               # Agent SDK workspace
├── agents/                  # AI agents
│   ├── architect/src/index.ts
│   ├── ops/src/index.ts
│   ├── planner/src/index.ts
│   └── reviewer/src/index.ts
└── playbooks/               # Agent playbooks (JSON)
    ├── add-mcp-tool.json
    ├── enhance-search-capabilities.json
    └── implement-github-integration.json
```

### Common Commands Reference

**Package.json scripts (root level):**
```bash
npm run build   # Build all workspaces
npm test        # Test all workspaces  
npm run lint    # Lint all TypeScript files
npm run check   # Run ICN validation checks
npm run mcp-server  # Start MCP server for Copilot
```

**Development workflow:**
```bash
# Standard development cycle
npm ci                    # Install dependencies (once)
npm run build            # Build everything
npm run lint && npm test # Validate code
npm run -w mcp-server dev # Start server for testing
```

### Agent Artifacts and Output

- **Task artifacts:** Written to `branches/<taskId>/...`
- **PR descriptors:** Written to `artifacts/PR-<taskId>.json`
- **Agent logs:** Console output during agent execution
- **Database:** SQLite database in `var/` directory (created automatically)

## MCP Tools for GitHub Copilot

When the MCP server is running, these tools are available to GitHub Copilot:

- `icn_get_architecture`: Get ICN architecture and protocol docs
- `icn_get_invariants`: List system invariants from catalog  
- `icn_check_policy`: Validate changes against ICN policies
- `icn_get_task_context`: Get full task briefings and constraints

## Troubleshooting

### Build Issues
- **"npm ci fails"**: Ensure Node.js v20 is installed (`node --version`)
- **"TypeScript errors"**: Run `npm run build` to see specific compilation errors
- **"Lint failures"**: Run `npm run lint` and fix warnings (max-warnings=0)

### Server Issues  
- **"Port 8787 in use"**: Kill existing server with `pkill -f "tsx src/index.ts"`
- **"Database errors"**: Remove `var/` directory and restart server
- **"Health check fails"**: Ensure server started successfully, check logs

### Agent Issues
- **"Task file missing"**: Agents may expect `tasks from Intent-0001` file
- **"Permission errors"**: Check file permissions and paths
- **"Agent crashes"**: Run with `node --inspect` for debugging

## Development Best Practices

- **Always build first**: Run `npm run build` before testing changes
- **Test incrementally**: Use `npm run -w <workspace> test` for focused testing
- **Follow conventions**: Check existing patterns in each workspace
- **Validate policies**: Use `icn_check_policy` tool to validate file changes
- **Update tests**: Add tests in `test/` directories following existing patterns
- **Check documentation**: Update relevant docs in `docs/` when changing APIs

## Environment Configuration

The system supports environment variable configuration via `.env` file:

```bash
# Copy example configuration
cp .env.example .env

# Edit as needed for development
# Key variables:
# REPO_ROOT - Override repository root path detection
# DOCS_ROOT - Override documentation directory (default: ./docs)
# MCP_DB_DIR - Override database directory (default: ./var)
# POLICY_RULES_PATH - Override policy file (default: ./mcp-server/policy.rules.json)
```

**Development example:**
```bash
DOCS_ROOT=./docs
MCP_DB_DIR=./tmp/db
POLICY_RULES_PATH=./mcp-server/policy.rules.json
```

## Architecture Quick Reference

- **HTTP Server (port 8787)**: Handles webhooks, tasks, worker protocol
- **MCP Server (stdio)**: Provides tools to GitHub Copilot via Model Context Protocol
- **Agents**: Independent TypeScript programs that process tasks and create PRs
- **Playbooks**: JSON files defining agent workflows and best practices
- **Policy System**: JSON rules governing what changes agents can make
- **Database**: SQLite for task tracking, worker coordination, and state

---

**Remember**: Always reference these instructions first. Only search or explore when you encounter unexpected behavior that doesn't match the information provided here.