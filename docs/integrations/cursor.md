## Cursor Worker Setup

### Security Features (v0.1)

The v0.1 "Wire the Pivot" release includes enhanced security features:

**Token Management**
- Auth tokens automatically expire after 24 hours (configurable)
- Token refresh endpoint `/api/agent/refresh` for seamless renewal
- Expired tokens are automatically cleaned up

**Policy Integration**
- Policy checks are enforced during task claiming (`/api/task/claim`)
- Policy checks are enforced during task execution (`/api/task/run`)
- Agents can only access files/paths according to their role-based permissions
- Policy denials are logged and tracked via metrics

**Stdio Stability**
- Robust error handling for broken pipes and connection timeouts
- Graceful shutdown on SIGINT/SIGTERM signals
- 30-second connection timeout with automatic retry logic
- Periodic health checks for stdio stream integrity

### Agent auth flow

Before performing any operations, agents must register and authenticate:

1. **Register**: Call `/api/agent/register` with agent name and kind
2. **Authenticate**: Use the returned token in `Authorization: Bearer <TOKEN>` header for all subsequent API calls
3. **Refresh**: Call `/api/agent/refresh` before token expires to get a new token
4. **Operations**: Use authenticated endpoints like `/api/task/claim`, `/api/task/create`, `/api/task/run`

**Note**: All task operations now include policy checks to ensure agents only access authorized file paths.

### Registration and Task Management

1. Register agent:
```bash
curl -X POST http://localhost:8787/api/agent/register -d '{"name":"Cursor","kind":"ops"}'
```
2. Claim tasks:
```bash
curl -H "Authorization: Bearer <TOKEN>" -X POST http://localhost:8787/api/task/claim
```
3. Fetch brief and execute steps, report progress via `/api/task/run`.


