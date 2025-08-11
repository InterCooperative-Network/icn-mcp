# Changelog

All notable changes to the InterCooperative Network MCP project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-10 - "Wire the Pivot"

### Added
- **Agent SDK MVP**: Complete API implementation with `registerAgent()`, `createTask()`, and `refreshToken()` functions
- **Agent authentication flow**: Proper registration and authentication for planner agent with token expiration
- **Policy engine**: `/api/policy/check` endpoint with path capabilities and CODEOWNERS integration
- **Worker protocol**: `/api/task/claim` and `/api/task/run` endpoints with policy integration
- **JSON validation pipeline**: CI validation for all JSON files including TypeScript configs across all workspaces
- **Architecture documentation**: Detailed pivot diagram and data flow explanation
- **Agent lifecycle documentation**: Registration, task claiming, execution, and policy evaluation
- **Stdio stability**: Robust error handling for broken pipes, timeouts, and connection issues
- **Token management**: 24-hour token expiration with refresh mechanism and cleanup

### Security Enhancements
- **Token expiration**: Auth tokens expire after 24 hours with automatic cleanup
- **Token refresh**: `/api/agent/refresh` endpoint for seamless token renewal
- **Policy enforcement**: All task operations (claim/run) include policy checks
- **Role-based access**: Agents can only access files according to their kind (planner/architect/reviewer/ops)
- **Error handling**: Comprehensive stdio error handling for production stability

### Fixed
- **TypeScript configuration formatting**: Converted single-line `mcp-server/tsconfig.json` to proper multi-line format
- **JSON syntax errors**: Resolved trailing commas in all agent `tsconfig.json` files
- **Linting issues**: Resolved 4 unused variable warnings across the codebase

### Changed
- **Agent planner**: Updated to register and authenticate before creating tasks
- **Type definitions**: Aligned with actual API contracts, including response types
- **MCP server**: Enhanced stdio transport with timeout and connection monitoring

### Architecture
- **Pivot architecture**: Establishes connection between Copilot/IDE ↔ MCP stdio ↔ HTTP HQ ↔ Agents ↔ GitHub
- **Testing coverage**: 41 tests passing (19 mcp-server + 16 mcp-node + 6 agent-sdk)
- **CI validation**: Recursive JSON validation across all workspaces with coverage reporting

## [Unreleased]

Changes that are in development but not yet released.