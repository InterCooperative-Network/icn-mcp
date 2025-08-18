# Task State Transitions

This document defines the allowed state transitions for tasks in the ICN MCP system.

## State Graph

```
queued -> in_progress -> completed
  |           |            ^
  |           v            |
  +-----> blocked --------+
  |           |            
  |           v            
  +-----> failed
```

## Valid States

- **queued**: Initial state when a task is created
- **in_progress**: Task has been claimed by an agent and is being worked on
- **blocked**: Task cannot proceed due to dependencies or external factors
- **completed**: Task has been successfully finished
- **failed**: Task encountered an error and cannot be completed

## Allowed Transitions

| From State    | To State      | Description |
|---------------|---------------|-------------|
| `queued`      | `in_progress` | Agent claims and starts working on task |
| `queued`      | `blocked`     | Task cannot start due to dependencies |
| `queued`      | `failed`      | Task cannot be started due to errors |
| `in_progress` | `completed`   | Task successfully finished |
| `in_progress` | `blocked`     | Task hits dependency or external blocker |
| `in_progress` | `failed`      | Task encounters unrecoverable error |
| `blocked`     | `in_progress` | Blocking condition resolved, work resumes |
| `blocked`     | `completed`   | Task completed while in blocked state |
| `blocked`     | `failed`      | Blocking condition leads to failure |

## Implementation

The `runTask()` SDK function validates state transitions to ensure only legal moves are allowed:

```typescript
const validTransitions = {
  'queued': ['in_progress', 'blocked', 'failed'],
  'in_progress': ['completed', 'blocked', 'failed'],
  'blocked': ['in_progress', 'completed', 'failed'],
  'completed': [], // Terminal state
  'failed': []     // Terminal state
};
```

Attempting an invalid transition will throw a `PolicyError`.