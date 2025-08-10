ICN MCP acts as HQ for agents coordinating work via PRs under policy and invariants. Agents register, receive tasks, and produce execution receipts. Policies gate actions; invariants ensure network-level guarantees.

## The Pivot Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Copilot/IDE   │◄──►│   MCP stdio     │
│   (Cursor)      │    │   Tools         │
└─────────────────┘    └─────────────────┘
                                │
                                │ stdio
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    GitHub       │◄──►│   HTTP HQ       │◄──►│     Agents      │
│  (webhooks,     │    │  (mcp-server)   │    │  (planner,      │
│   API, PRs)     │    │                 │    │   reviewer,     │
└─────────────────┘    └─────────────────┘    │   architect,    │
                                              │   ops)          │
                                              └─────────────────┘
```

### Data Flow

1. **MCP stdio ↔ Copilot**: Development tools communicate with ICN via Model Context Protocol over stdio, accessing architecture context, invariants, and policy checks
2. **HTTP HQ ↔ Agents**: Distributed agents register with the central HTTP server, claim tasks, and report execution progress
3. **HTTP HQ ↔ GitHub**: Webhooks trigger task creation, agents create PRs through the server's GitHub integration

### Agent Lifecycle

1. **Registration**: Agents call `/api/agent/register` to receive authentication tokens
2. **Task Claiming**: Authenticated agents poll `/api/task/claim` for available work
3. **Execution**: Agents retrieve context via `/api/context/brief` and report progress via `/api/task/run`
4. **Policy Evaluation**: All actions are gated by policy rules defined in `policy.rules.json`
5. **Receipt Emission**: Execution results are tracked and can be audited through the system

TODO: Expand on agent lifecycle, policy evaluation points, and receipt emission.

