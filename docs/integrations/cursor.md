## Cursor Worker Setup

1. Register agent:
```bash
curl -X POST http://localhost:8787/api/agent/register -d '{"name":"Cursor","kind":"ops"}'
```
2. Claim tasks:
```bash
curl -H "Authorization: Bearer <TOKEN>" -X POST http://localhost:8787/api/task/claim
```
3. Fetch brief and execute steps, report progress via `/api/task/run`.


