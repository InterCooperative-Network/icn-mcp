# ICN MCP Agent HQ
MCP (Model Context Protocol) server and agent ecosystem to orchestrate AI agents for ICN development. Everything via PRs, under policy and invariants.

**Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Bootstrap, Build, and Test the Repository:
- Use Node.js v20: `node --version` should show v20.x (already available in this environment)
- Install dependencies: `npm ci` -- takes ~45 seconds. NEVER CANCEL. Set timeout to 90+ seconds.
- Lint the code: `npm run lint` -- takes ~1.5 seconds. Must pass with zero warnings.
- Run tests: `npm test` -- takes ~3-4 seconds. NEVER CANCEL. Set timeout to 60+ seconds.
- Build the project: `npm run build` -- takes ~4-5 seconds. NEVER CANCEL. Set timeout to 60+ seconds.
- Run checks: `npm run check` -- takes <1 second. Validates spec links and invariants.

### Complete Validation Sequence:
Run this exact sequence for full validation:
```bash
cd /path/to/icn-mcp
npm ci
npm run lint
npm test
npm run build
npm run check
```
**NEVER CANCEL any of these commands.** Total time: ~50-60 seconds.

### Run the MCP Server:
- **ALWAYS run the bootstrapping steps first** (npm ci, lint, test, build)
- Start server: `npm run -w mcp-server dev` -- starts immediately, runs on port 8787
- Health check: `curl http://localhost:8787/healthz` should return `{"ok":true}`
- Metrics: `curl http://localhost:8787/metrics` shows Prometheus format metrics
- Dashboard: `curl http://localhost:8787/dashboard` shows HTML metrics dashboard

### Run Agents:
With the MCP server running in another terminal:
- Planner: `npx tsx agents/planner/src/index.ts` (creates tasks from Intent-0001)
- Architect: `npx tsx agents/architect/src/index.ts --task <TASK_ID>` (drafts signing-context and creates local PR descriptor)

**Note:** Agents require the MCP server to be running. Use `npx tsx` to run TypeScript files directly.

## Validation Requirements

### Always Validate Changes:
- **CRITICAL**: After making any changes, ALWAYS run the complete validation sequence: `npm run lint && npm test && npm run build && npm run check`
- **SCENARIO TESTING**: Test the MCP server after changes:
  1. Start server: `npm run -w mcp-server dev`
  2. Test health endpoint: `curl http://localhost:8787/healthz`
  3. Verify metrics endpoint works: `curl http://localhost:8787/metrics`
  4. Check dashboard loads: `curl http://localhost:8787/dashboard`
- **NEVER skip validation** because it appears to take too long - validation is fast (~1 minute total)

### CI Requirements:
- All CI steps must pass: lint, test, build, and check
- No ESLint warnings allowed (`--max-warnings=0`)
- PRs required; no direct pushes
- Public API changes must reference a spec/RFC

## Common Tasks and Timing

### Expected Command Timings:
- `npm ci`: ~45 seconds (**NEVER CANCEL** - set 90+ second timeout)
- `npm run lint`: ~1.5 seconds  
- `npm test`: ~3-4 seconds (**NEVER CANCEL** - set 60+ second timeout)
- `npm run build`: ~4-5 seconds (**NEVER CANCEL** - set 60+ second timeout)
- `npm run check`: <1 second
- Server startup: immediate

### Repository Structure:
```
/home/runner/work/icn-mcp/icn-mcp/
├── mcp-server/          # Main MCP server (Fastify, SQLite, GitHub webhooks)
├── agent-sdk/           # SDK for building agents
├── agents/              # AI agents (planner, architect, ops, reviewer)
│   ├── planner/         # Creates tasks from intents
│   ├── architect/       # Drafts signing context, creates PR descriptors
│   ├── ops/             # Operations agent
│   └── reviewer/        # Code review agent
├── docs/                # Documentation and API reference
├── db/                  # Database schema and migrations
├── tools/ci/            # CI validation scripts
└── .github/workflows/   # CI configuration
```

### Key Files:
- `package.json`: Workspace configuration with build scripts
- `eslint.config.mjs`: ESLint configuration
- `tsconfig.base.json`: Base TypeScript configuration
- `.nvmrc`: Node.js version specification (v20)
- `mcp-server/src/index.ts`: Main server entry point
- `docs/api-reference.md`: Complete API documentation

### Package.json Scripts Reference:
```json
{
  "scripts": {
    "build": "npm run -ws --if-present build",
    "test": "npm run -ws --if-present test", 
    "lint": "eslint \"**/*.ts\" --max-warnings=0",
    "check": "node tools/ci/validate_spec_links.js && node tools/ci/check_invariants.js"
  }
}
```

## Common Development Patterns

### Code Organization:
- **MCP Server** (`mcp-server/src/`):
  - `index.ts`: Main Fastify server setup
  - `api.ts`: REST API routes 
  - `db.ts`: SQLite database operations
  - `webhooks.ts`: GitHub webhook handling
  - `policy.ts`: Policy enforcement rules
  - `metrics.ts`: Prometheus metrics + dashboard
  - `auth.ts`: Bearer token authentication
  - `github.ts`: GitHub API integration

### Key Implementation Notes:
- **Template literals in HTML**: When generating HTML with embedded JavaScript, escape template literals carefully: use `\`backticks\`` for the outer template and `\${variable}` for inner JavaScript
- **Error handling**: Use try/catch blocks with proper error parameters, avoid empty catch blocks
- **Async operations**: Most database and GitHub operations are async - use proper await/Promise handling
- **Workspace management**: This is a monorepo with npm workspaces - use `-w workspace-name` for workspace-specific commands

### File Watching and Hot Reload:
- **Development**: `npm run -w mcp-server dev` uses tsx for hot reload
- **Policy files**: Server watches `policy.rules.json` and CODEOWNERS for changes
- **Environment**: Set NODE_ENV=development for detailed logging

## Development Workflow


### Making Changes:
1. **Always start with full validation**: `npm ci && npm run lint && npm test && npm run build && npm run check`
2. Make your changes
3. **Immediately re-validate**: `npm run lint && npm test && npm run build`
4. Test functionality manually by starting the server and testing endpoints
5. **Final validation**: Run the complete sequence again before committing

### Working with the MCP Server:
- **Technology**: Fastify server with SQLite database, GitHub webhooks, Bearer token auth
- **Port**: 8787 (hardcoded in configuration)
- **Database**: SQLite with tables for tasks, dependencies, runs, and artifacts
- **Key endpoints**: 
  - `/healthz` - Health check (returns `{"ok":true}`)
  - `/metrics` - Prometheus metrics
  - `/dashboard` - HTML metrics dashboard
  - `/api/task/*` - Task management APIs
  - `/api/webhooks/github` - GitHub webhook receiver
- **Policy**: Enforces rules via `policy.rules.json` and CODEOWNERS
- **Logging**: Uses pino with pretty printing in development

### Working with Agents:
- All agents are TypeScript and use the agent-sdk
- Run with `npx tsx` for direct TypeScript execution
- Agents communicate with the MCP server via HTTP API
- Artifacts written to `branches/<taskId>/` and `artifacts/PR-<taskId>.json`

## Troubleshooting

### Build Issues:
- **Template literal syntax errors**: In HTML-generating code, use `\`backticks\`` to escape template literals within template literals
- **Duplicate catch blocks**: Remove empty catch blocks, keep only the ones with error parameters
- **Import/export errors**: Ensure all files use ES modules (`"type": "module"` in package.json)

### Server Issues:
- **ECONNREFUSED**: Server not running - start with `npm run -w mcp-server dev`
- **Port conflicts**: Server uses port 8787 - ensure no other process is using it
- **Database issues**: SQLite database is created automatically in development

### Agent Issues:
- **File extension errors**: Use `npx tsx` instead of `node` for TypeScript files
- **Connection errors**: Ensure MCP server is running before starting agents

## Critical Reminders
- **NEVER CANCEL** any build, test, or install command - they complete quickly
- **ALWAYS validate** after making changes - validation is fast and catches issues early
- **Use exact timeouts**: 90 seconds for npm ci, 60 seconds for tests/builds
- **Test manually**: Always verify server endpoints work after changes
- **PRs only**: No direct pushes allowed to the repository