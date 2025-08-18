# Changelog

All notable changes to the Agent SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-12-19

### Added
- Initial release of the Agent SDK
- Complete HTTP client abstraction with undici
- Typed error classes (HttpError, AuthError, PolicyError, RateLimitError)
- Automatic retry logic with exponential backoff
- Automatic token refresh on 401 responses
- Client-based SDK interface with `createClient()`
- Zod schema validation for all API responses
- Comprehensive timeout configuration (connect and total timeouts)
- Legacy function-based API for backward compatibility

### Features
- `ICNClient` class with organized namespaces for tasks, policy, and PR operations
- `createClient()` factory function for easy client creation
- Automatic policy validation and error handling
- Rate limiting support with retry-after headers
- Network error recovery with configurable retry policies
- Type-safe API with runtime validation

### API
- Agent operations: `registerAgent()`, `refreshToken()`
- Task operations: `tasks.create()`, `tasks.claim()`, `tasks.update()`
- Policy operations: `policy.check()`
- PR operations: `pr.create()`
- Legacy functions: All original functions maintained for compatibility

### Configuration
- Configurable timeouts (default: 10s connect, 60s total)
- Configurable retry policy (default: 3 retries, 250ms-4s backoff)
- Automatic rate limiting handling
- Flexible error handling and recovery