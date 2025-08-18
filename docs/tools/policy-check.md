# Policy CLI Tool

The policy CLI tool (`tools/policy-check.js`) provides command-line validation of file changes against ICN MCP policy rules.

## Usage

```bash
node tools/policy-check.js [options]
```

### Options

- `--actor <name>` - Actor/agent name to check (required)
- `--diff <file>` - Path to diff file (use `-` for stdin)
- `--git [ref]` - Check git diff against ref (default: `HEAD`)
- `--paths <paths>` - Comma-separated list of file paths to check
- `--help` - Show help message

### Examples

#### Check current working directory changes
```bash
node tools/policy-check.js --actor architect --git
```

#### Check changes against main branch
```bash
node tools/policy-check.js --actor planner --git main
```

#### Check specific file paths
```bash
node tools/policy-check.js --actor ops --paths "ci/deploy.yml,tools/build.sh"
```

#### Check diff from file
```bash
git diff > changes.diff
node tools/policy-check.js --actor reviewer --diff changes.diff
```

#### Check diff from stdin
```bash
git diff | node tools/policy-check.js --actor architect --diff -
```

## Output

### Success (Exit code 0)
```
📁 Found 2 changed file(s):
   docs/api.md
   docs/guide.md

🔐 Checking policy for actor: architect
✅ Policy check passed - all changes are authorized
```

### Failure (Exit code 1)
```
📁 Found 1 changed file(s):
   mcp-server/src/db.ts

🔐 Checking policy for actor: architect
❌ Policy check failed - unauthorized changes detected:
   • path mcp-server/src/db.ts not allowed for actor architect
   • CODEOWNERS: mcp-server/src/db.ts requires approval from fahertym, not architect

💡 Suggestions:
   • Consider requesting permission or modifying files within your authorized paths
   • Request review from the appropriate code owners before proceeding
```

## Policy Rules

The tool reads policy rules from `mcp-server/policy.rules.json` and `CODEOWNERS` file. All rules must pass for changes to be authorized:

1. **Path Capabilities**: Actor must have permission for each changed path via `path_caps`
2. **CODEOWNERS**: If enabled, actor must be listed as owner for each changed path  
3. **Reviews Required**: Actor must be in required reviewers list for affected paths

## Integration

The CLI tool is integrated into the repository's check pipeline:

```bash
npm run check  # Includes policy CLI tests
```

Tests are located in `tools/ci/test-policy-cli.js`.

## Diff Format Support

The tool supports multiple diff formats:

- Git diff format (`git diff`)
- Unified diff format 
- SVN diff format (`Index: path`)

File paths are automatically extracted and normalized.