# Changelog

All notable changes to the InterCooperative Network MCP project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-10 - "Wire the Pivot"

### Added
- **Agent SDK MVP**: Complete API implementation with `registerAgent()` and `createTask()` functions
- **Agent authentication flow**: Proper registration and authentication for planner agent
- **Policy engine**: `/api/policy/check` endpoint with path capabilities and CODEOWNERS integration
- **JSON validation pipeline**: CI validation for all JSON files including TypeScript configs
- **Architecture documentation**: Detailed pivot diagram and data flow explanation
- **Agent lifecycle documentation**: Registration, task claiming, execution, and policy evaluation

### Fixed
- **TypeScript configuration formatting**: Converted single-line `mcp-server/tsconfig.json` to proper multi-line format
- **JSON syntax errors**: Resolved trailing commas in all agent `tsconfig.json` files
- **Linting issues**: Resolved 4 unused variable warnings across the codebase

### Changed
- **Agent planner**: Updated to register and authenticate before creating tasks
- **Type definitions**: Aligned with actual API contracts, including response types

### Architecture
- **Pivot architecture**: Establishes connection between Copilot/IDE ↔ MCP stdio ↔ HTTP HQ ↔ Agents ↔ GitHub
- **Testing coverage**: 39 tests passing (19 mcp-server + 16 mcp-node + 4 agent-sdk)

## [Unreleased]

Changes that are in development but not yet released.