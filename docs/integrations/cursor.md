## Cursor Worker Setup

### Agent auth flow

Before performing any operations, agents must register and authenticate:

1. **Register**: Call `/api/agent/register` with agent name and kind
2. **Authenticate**: Use the returned token in `Authorization: Bearer <TOKEN>` header for all subsequent API calls
3. **Operations**: Use authenticated endpoints like `/api/task/claim`, `/api/task/create`, `/api/task/run`

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


