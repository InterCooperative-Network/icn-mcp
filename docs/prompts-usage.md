# ICN MCP Prompt Templates Usage Guide

This document demonstrates how to use the new prompt templates in the ICN MCP system.

## Available Prompts

The ICN MCP server now supports four prompt templates for common workflows:

1. **`code-review`** - Review code changes with ICN policy and invariants in mind
2. **`adr-template`** - Template for writing Architectural Decision Records
3. **`release-notes`** - Generate release notes by summarizing merged PRs
4. **`governance-proposal`** - Create governance proposals following democratic principles

## When to Use Each Template

### Code Review (`code-review`)
**Use when:** Reviewing pull requests, conducting design reviews, or validating changes
**Focus:** ICN invariant compliance, policy adherence, code quality
**Key checks:** Event sourcing, deterministic operations, democratic governance, anti-centralization

### ADR Template (`adr-template`)  
**Use when:** Making architectural decisions, documenting design choices, planning major changes
**Focus:** Structured decision documentation with ICN alignment
**Key elements:** Context, decision rationale, consequences, ICN principle compliance

### Release Notes (`release-notes`)
**Use when:** Preparing releases, communicating changes to community, documenting progress
**Focus:** Categorized changes with governance and protocol updates highlighted
**Key sections:** Features, fixes, governance changes, ICN protocol updates

### Governance Proposal (`governance-proposal`)
**Use when:** Proposing policy changes, community decisions, federation coordination
**Focus:** Democratic decision-making process, economic impact, community input
**Key aspects:** Voting mechanisms, principle alignment, federation impact

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

### Governance Proposal Prompt

```javascript
const governanceProposal = await mcpClient.getPrompt('governance-proposal', {
  title: 'Implement Multi-Federation Coordination Protocol',
  proposer: 'Alice Cooper',
  summary: 'Standardize cross-federation coordination and resource sharing',
  federationScope: 'all',
  economicImpact: 'significant'
});
```

**Generated proposal includes:**
- Democratic voting process definition
- ICN principle alignment checklist
- Economic impact assessment (when specified)
- Community input sections
- Implementation timeline and responsibilities

## Example Outputs

### Code Review Output Example

When you use the `code-review` template with suspicious code:

**Input:**
```javascript
const result = await mcpClient.getPrompt('code-review', {
  changes: `
+ function purchaseVotingRights(tokens) {
+   return user.votingPower += tokens * VOTE_MULTIPLIER;
+ }`,
  context: 'Adding token-based voting system'
});
```

**Generated Output (excerpt):**
```markdown
# ICN Code Review

## Instructions
You are reviewing code changes for the InterCooperative Network (ICN) project. Your review should focus on:

1. **ICN Invariants Compliance**: Ensure changes align with ICN core principles:
   - Event-sourced architecture
   - Deterministic operations
   - Democratic governance structures
   - Non-transferable coordination credits (CC)
   - No token-bought voting mechanisms

[...detailed code analysis sections...]

## Review Focus Areas
- [ ] Does this maintain event-sourced patterns?
- [ ] Are democratic governance principles preserved?
- [ ] Is proper authorization/policy checking in place?
- [ ] Are there any centralization risks?
- [ ] Is the implementation deterministic?
- [ ] Are tests adequate for the changes?
- [ ] Is documentation updated as needed?

Please provide a detailed review covering these areas and any other concerns.
```

**How this helps:** The LLM will specifically check for token-voting violations, centralization risks, and democratic governance preservation rather than just doing generic code review.

### Governance Proposal Output Example

**Input:**
```javascript
const proposal = await mcpClient.getPrompt('governance-proposal', {
  title: 'Adopt Consensus-Based Federation Coordination',
  proposer: 'Federation Council',
  economicImpact: 'moderate'
});
```

**Generated Output (excerpt):**
```markdown
# Governance Proposal: Adopt Consensus-Based Federation Coordination

**Proposer:** Federation Council  
**Date:** 2024-01-15
**Status:** Draft

## Summary

[Provide a concise summary of what this proposal aims to achieve and why it matters for the ICN community]

## Economic Impact Assessment

### Mana/Coordination Credit Effects
[Describe how this proposal affects mana allocation, coordination credits, or economic incentives]

### Federation Impact  
[How will this affect different federations' resources and capabilities?]

## ICN Principle Alignment

This proposal maintains ICN core principles:

- [ ] **Democratic Governance**: Decision made through proper democratic processes
- [ ] **Event-Sourced**: Changes are recorded as immutable events
- [ ] **Deterministic**: Outcomes are predictable and reproducible
- [ ] **Non-Transferable Credits**: Coordination credits remain personal/non-tradeable
- [ ] **Anti-Token-Voting**: No mechanisms that allow wealth-based voting power
- [ ] **Federation Autonomy**: Respects individual federation sovereignty
- [ ] **Cooperative Values**: Enhances mutual aid and collective benefit

[...detailed voting process and community input sections...]
```

**How this helps:** Ensures all governance proposals follow democratic principles and explicitly check for compliance with ICN invariants.

## How Templates Embody ICN Invariants

### Anti-Centralization Design
Each template explicitly prompts for checking centralization risks:
- **Code Review**: "Are there any centralization risks?"
- **ADR**: "Supports federation scalability" 
- **Governance**: "Federation Autonomy" checkbox
- **Release Notes**: Dedicated "Governance & Policy" section

### Democratic Governance Enforcement  
Templates enforce democratic decision-making:
- **Code Review**: Checks for "Democratic governance structures"
- **ADR**: "Enhances democratic governance" in consequences
- **Governance**: Detailed voting process requirements
- **Release Notes**: Highlights governance changes separately

### Event-Sourced Architecture
All templates reference event sourcing:
- **Code Review**: "Does this maintain event-sourced patterns?"
- **ADR**: "Maintains event-sourced architecture" checklist item
- **Governance**: "Event-Sourced: Changes are recorded as immutable events"

### Non-Transferable Coordination Credits
Templates prevent token economy patterns:
- **Code Review**: "No token-bought voting mechanisms" 
- **ADR**: "Preserves non-transferable CC model"
- **Governance**: "Non-Transferable Credits" and "Anti-Token-Voting" checks

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
- **Built-in variables**: `{{currentDate}}` for current date in YYYY-MM-DD format
- **Argument validation**: Required vs optional parameters
- **ICN-specific content**: All templates include ICN principles and invariants
- **Type safety**: Full TypeScript interfaces for all prompt components

## Adding New Templates

To add a new prompt template:

1. **Define the template** in `mcp-node/src/prompts/templates.ts`:
```typescript
export const myNewPrompt: ICNPrompt = {
  name: 'my-template',
  description: 'Description of what this template does',
  category: 'workflow', // or 'documentation', 'review', 'governance'
  arguments: [
    {
      name: 'requiredArg',
      description: 'Description of required argument',
      required: true,
    },
    {
      name: 'optionalArg', 
      description: 'Description of optional argument',
      required: false,
    },
  ],
  template: `# My Template

{{requiredArg}}

{{#if optionalArg}}
Optional content: {{optionalArg}}
{{/if}}

## ICN Principle Check
- [ ] Maintains democratic governance
- [ ] Preserves event-sourced architecture
...
`,
};
```

2. **Add to exports** in the same file:
```typescript
export const ICN_PROMPTS: ICNPrompt[] = [
  // ... existing prompts
  myNewPrompt,
];
```

3. **Update type definitions** in `types.ts` if adding new categories.

4. **Add tests** in `test/prompts.test.ts` following existing patterns.

The template system is designed for easy extension while maintaining ICN principle compliance.

## Testing

Run comprehensive tests with:
```bash
npm test # Includes 30+ prompt-specific tests
npm run lint # Ensures code quality
npm run build # Verifies compilation
```

All prompts are thoroughly tested for:
- Template interpolation accuracy
- Argument validation
- ICN-specific content inclusion
- Invariant violation detection
- Error handling
- Integration with MCP protocol
- Edge cases and malformed inputs

The implementation follows ICN principles and maintains compatibility with existing tools and workflows.