# ICN MCP Prompt Templates Usage Guide

This document demonstrates how to use the new prompt templates in the ICN MCP system.

## Available Prompts

The ICN MCP server now supports three prompt templates for common workflows:

1. **`code-review`** - Review code changes with ICN policy and invariants in mind
2. **`adr-template`** - Template for writing Architectural Decision Records
3. **`release-notes`** - Generate release notes by summarizing merged PRs

## Usage Examples

### Code Review Prompt

```javascript
// List all available prompts
const prompts = await mcpClient.listPrompts();

// Generate a code review prompt
const codeReview = await mcpClient.getPrompt('code-review', {
  changes: `
+ console.log("Adding democratic voting feature");
+ const votes = await collectVotes(proposal);
+ if (hasTokenBasedVoting(votes)) {
+   throw new Error("Token-based voting violates ICN invariants");
+ }`,
  files: ['src/governance/voting.ts'],
  context: 'Implementing new democratic voting mechanism'
});
```

**Generated prompt includes:**
- ICN invariants compliance checklist
- Policy adherence verification
- Code quality review standards
- Specific focus on event-sourced, deterministic, democratic patterns

### ADR Template Prompt

```javascript
const adrTemplate = await mcpClient.getPrompt('adr-template', {
  title: 'Adopt Model Context Protocol for AI agent integration',
  context: 'Need standardized way for agents to access ICN tools and data',
  decision: 'Implement MCP server with prompt templates and tool manifests'
});
```

**Generated template includes:**
- Structured ADR format (Context, Decision, Consequences)
- ICN alignment checklist
- Implementation notes section
- References to ICN specifications

### Release Notes Prompt

```javascript
const releaseNotes = await mcpClient.getPrompt('release-notes', {
  version: 'v1.5.0',
  lastTag: 'v1.4.2',
  prList: `
- #123: Add prompt templates for MCP
- #124: Fix template interpolation  
- #125: Add comprehensive tests`,
  highlights: 'Major new feature: MCP prompt templates for common workflows'
});
```

**Generated notes include:**
- Categorized changes (Features, Fixes, Governance)
- ICN protocol updates section
- Migration guide placeholder
- Cooperative principles acknowledgment

## MCP Protocol Integration

The prompts are fully integrated with the Model Context Protocol:

### List Prompts
```json
{
  "method": "prompts/list",
  "params": {}
}
```

Response includes all available prompts with their descriptions and argument schemas.

### Get Prompt
```json
{
  "method": "prompts/get", 
  "params": {
    "name": "code-review",
    "arguments": {
      "changes": "diff content here",
      "files": ["src/file.ts"],
      "context": "optional context"
    }
  }
}
```

Response includes the generated prompt as a message ready for LLM consumption.

## Template Features

- **Conditional rendering**: `{{#if variable}}content{{else}}alternative{{/if}}`
- **Variable substitution**: `{{variableName}}`
- **Argument validation**: Required vs optional parameters
- **ICN-specific content**: All templates include ICN principles and invariants
- **Type safety**: Full TypeScript interfaces for all prompt components

## Testing

Run comprehensive tests with:
```bash
npm test # Includes 23 prompt-specific tests
npm run lint # Ensures code quality
npm run build # Verifies compilation
```

All prompts are thoroughly tested for:
- Template interpolation accuracy
- Argument validation
- ICN-specific content inclusion
- Error handling
- Integration with MCP protocol

The implementation follows ICN principles and maintains compatibility with existing tools and workflows.