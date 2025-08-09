## Policy Rules Format

File: `mcp-server/policy.rules.json`

Schema:

```json
{
  "no_direct_merges": true,
  "path_caps": { "actor": ["glob", "..."] },
  "reviews_required": [ { "paths": ["glob"], "reviewers": ["team"] } ]
}
```

### Semantics

- path_caps: limits which file paths an `actor` may modify. Simple glob rules supported:
  - `prefix/**` means any path starting with `prefix/`.
  - Exact match string for other cases.
- reviews_required: advisory for future use; not enforced in v0.1.

### Decision Function

`POST /api/policy/check` evaluates:

- If any `changedPaths` is not allowed by `path_caps[actor]`, returns `{ allow: false, reasons: [..] }`.
- Otherwise returns `{ allow: true, reasons: [] }`.


