## GitHub Copilot Agent Integration

1. Configure webhook:
   - URL: `https://<host>/api/webhooks/github`
   - Secret: `WEBHOOK_SECRET`
   - Events: Issues, PRs, Comments, Checks
2. Copilot worker flow:
   - Claim tasks via `POST /api/task/claim`
   - Fetch brief via `GET /api/context/brief?task_id=...`
   - Run and report via `POST /api/task/run`
   - Create PRs via `POST /api/pr/create`


