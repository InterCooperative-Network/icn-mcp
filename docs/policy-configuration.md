# ICN MCP Policy Configuration

The ICN MCP policy engine enforces access control and code review requirements for AI agents. Policy rules are defined in JSON format and support integration with GitHub CODEOWNERS files.

## Policy Rules File

Policy rules are stored in `mcp-server/policy.rules.json`. The file is watched for changes and automatically reloaded.

## Schema

```typescript
type PolicyRules = {
  no_direct_merges?: boolean;
  codeowners_integration?: boolean;
  path_caps?: Record<string, string[]>;
  reviews_required?: Array<{ paths: string[]; reviewers: string[] }>;
};
```

## Configuration Options

### `no_direct_merges`

**Type:** `boolean`  
**Default:** `true`

When enabled, prevents direct merges to protected branches. All changes must go through pull requests.

### `codeowners_integration`

**Type:** `boolean`  
**Default:** `false`

When enabled, integrates with the repository's CODEOWNERS file to enforce ownership-based access control.

### `path_caps`

**Type:** `Record<string, string[]>`

Defines path-based capabilities for different agent types. Each agent kind can be granted access to specific file patterns.

**Example:**
```json
{
  "path_caps": {
    "architect": ["docs/**", "mcp-server/src/types.ts"],
    "planner": ["tasks/**", "docs/tasks/**"],
    "reviewer": ["docs/**", ".github/**", "ci/**"],
    "ops": [".github/**", "ci/**", "tools/**"]
  }
}
```

### `reviews_required`

**Type:** `Array<{ paths: string[]; reviewers: string[] }>`

Defines specific paths that require review from designated reviewers.

**Example:**
```json
{
  "reviews_required": [
    {
      "paths": ["docs/protocols/**", "docs/security/**"],
      "reviewers": ["security", "fahertym"]
    },
    {
      "paths": [".github/**", "ci/**"],
      "reviewers": ["ops", "fahertym"]
    }
  ]
}
```

## Path Pattern Matching

The policy engine supports several pattern matching formats:

### Exact Match
```
"exact/file/path.ts"
```
Matches only the specified file.

### Directory Match
```
"docs/"
```
Matches the directory and any files directly in it.

### Recursive Directory Match
```
"docs/**"
```
Matches the directory and all files/subdirectories within it.

### Wildcard Patterns
```
"*.ts"           # All TypeScript files
"test_*.js"      # Files starting with "test_"
"docs/*.md"      # Markdown files in docs directory
```

### Complex Patterns
```
"src/**/test/*.ts"   # TypeScript test files in any subdirectory
"*.{js,ts}"          # JavaScript or TypeScript files (requires regex)
```

## CODEOWNERS Integration

When `codeowners_integration` is enabled, the policy engine reads the repository's CODEOWNERS file to enforce ownership rules.

### CODEOWNERS Format

```
# Global owner
* @fahertym

# Docs owned by docs team
docs/ @docs-team @fahertym

# Security-sensitive files
docs/security/ @security-team @fahertym
mcp-server/src/auth.ts @security-team @fahertym

# CI/CD owned by ops
.github/ @ops-team
ci/ @ops-team
```

### Integration Behavior

1. When a change affects a file covered by CODEOWNERS, the acting agent must be listed as an owner
2. The first matching pattern in CODEOWNERS takes precedence
3. Wildcard owners (`*`) allow any agent to modify the file
4. CODEOWNERS rules are combined with `path_caps` rules (both must pass)

## Agent Types

The system recognizes these agent types for policy enforcement:

- **planner**: Creates and manages tasks
- **architect**: Designs system components and documentation
- **reviewer**: Reviews code and documentation changes
- **ops**: Manages infrastructure and CI/CD

## Example Complete Configuration

```json
{
  "no_direct_merges": true,
  "codeowners_integration": true,
  "path_caps": {
    "architect": [
      "docs/**",
      "mcp-server/src/types.ts",
      "mcp-server/src/api.ts"
    ],
    "planner": [
      "tasks/**",
      "docs/tasks/**",
      "docs/planning/**"
    ],
    "reviewer": [
      "docs/**",
      ".github/**",
      "ci/**",
      "tools/**",
      "*.md"
    ],
    "ops": [
      ".github/**",
      "ci/**",
      "tools/**",
      "mcp-server/src/metrics.ts",
      "mcp-server/src/index.ts",
      "Dockerfile",
      "*.yml",
      "*.yaml"
    ]
  },
  "reviews_required": [
    {
      "paths": [
        "docs/protocols/**",
        "docs/security/**"
      ],
      "reviewers": ["security", "fahertym"]
    },
    {
      "paths": [
        ".github/**",
        "ci/**",
        "Dockerfile"
      ],
      "reviewers": ["ops", "fahertym"]
    },
    {
      "paths": [
        "mcp-server/src/auth.ts",
        "mcp-server/src/policy.ts"
      ],
      "reviewers": ["security", "fahertym"]
    }
  ]
}
```

## Policy Decision Process

When evaluating a policy check request:

1. **Path Capabilities Check**: Verify the agent has path access via `path_caps`
2. **CODEOWNERS Check**: If enabled, verify agent is listed as owner for affected paths
3. **Reviews Required Check**: Verify agent is in required reviewers list for affected paths
4. **Combine Results**: All checks must pass for the action to be allowed

## Error Messages

Policy denial reasons are descriptive and include:

- `"path {path} not allowed for actor {agent}"`
- `"CODEOWNERS: {path} requires approval from {owners}, not {agent}"`
- `"review required: paths {paths} require approval from {reviewers}"`

## Best Practices

1. **Principle of Least Privilege**: Grant only necessary path access
2. **Defense in Depth**: Use both `path_caps` and CODEOWNERS for critical paths
3. **Clear Ownership**: Ensure all critical paths have designated owners
4. **Regular Review**: Periodically audit and update policy rules
5. **Test Policies**: Use the `/api/policy/check` endpoint to test rule changes

## Monitoring

Policy decisions are logged with structured logging and tracked in metrics:

- `icn_mcp_policy_denies_total`: Counter of policy denials
- Request logs include policy decision details
- Dashboard shows policy denial trends