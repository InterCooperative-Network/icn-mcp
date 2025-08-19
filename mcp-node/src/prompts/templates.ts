import { ICNPrompt } from './types.js';

/**
 * Code review prompt template that instructs the model on reviewing code changes
 * with ICN policy and invariants in mind
 */
export const codeReviewPrompt: ICNPrompt = {
  name: 'code-review',
  description: 'Review code changes with ICN policy and invariants in mind',
  category: 'review',
  arguments: [
    {
      name: 'changes',
      description: 'The code changes to review (diff format)',
      required: true,
    },
    {
      name: 'files',
      description: 'List of files being modified',
      required: false,
    },
    {
      name: 'context',
      description: 'Additional context about the changes',
      required: false,
    },
  ],
  template: `# ICN Code Review

## Instructions
You are reviewing code changes for the InterCooperative Network (ICN) project. Your review should focus on:

1. **ICN Invariants Compliance**: Ensure changes align with ICN core principles:
   - Event-sourced architecture
   - Deterministic operations
   - Democratic governance structures
   - Non-transferable coordination credits (CC)
   - No token-bought voting mechanisms

2. **Policy Adherence**: Verify changes comply with ICN policies:
   - File modification permissions
   - Actor authorization levels
   - Scope restrictions

3. **Code Quality**: Standard code review practices:
   - Logic correctness
   - Security considerations
   - Performance implications
   - Testing coverage
   - Documentation completeness

## Code Changes to Review
{{#if files}}
**Files Modified:** {{files}}
{{/if}}

\`\`\`diff
{{changes}}
\`\`\`

{{#if context}}
## Additional Context
{{context}}
{{/if}}

## Review Focus Areas
- [ ] Does this maintain event-sourced patterns?
- [ ] Are democratic governance principles preserved?
- [ ] Is proper authorization/policy checking in place?
- [ ] Are there any centralization risks?
- [ ] Is the implementation deterministic?
- [ ] Are tests adequate for the changes?
- [ ] Is documentation updated as needed?

Please provide a detailed review covering these areas and any other concerns.`,
};

/**
 * ADR (Architectural Decision Record) template prompt
 */
export const adrTemplatePrompt: ICNPrompt = {
  name: 'adr-template',
  description: 'Template for writing Architectural Decision Records for ICN',
  category: 'documentation',
  arguments: [
    {
      name: 'title',
      description: 'The title of the architectural decision',
      required: true,
    },
    {
      name: 'context',
      description: 'Background context for the decision',
      required: false,
    },
    {
      name: 'decision',
      description: 'The architectural decision being made',
      required: false,
    },
  ],
  template: `# ADR: {{title}}

**Status:** Draft

## Context

{{#if context}}
{{context}}
{{else}}
[Describe the architectural issue or opportunity that requires a decision. Include:
- Current state and limitations
- Business/technical drivers
- Stakeholder concerns
- ICN-specific constraints (governance, coordination credits, federation)]
{{/if}}

## Decision

{{#if decision}}
{{decision}}
{{else}}
[State the architectural decision that addresses the context. Include:
- What will be built/changed
- How it aligns with ICN principles
- Key design choices and rationale]
{{/if}}

## Consequences

### Positive
- [List benefits and advantages]
- [ICN invariant compliance maintained]
- [Democratic governance enhanced]

### Negative
- [List risks and disadvantages]
- [Technical debt or limitations]
- [Implementation complexity]

### Neutral
- [Other implications worth noting]
- [Trade-offs made]

## ICN Alignment Check

- [ ] Maintains event-sourced architecture
- [ ] Supports deterministic operations
- [ ] Enhances democratic governance
- [ ] Preserves non-transferable CC model
- [ ] Prevents token-bought voting
- [ ] Supports federation scalability
- [ ] Aligns with cooperative principles

## Implementation Notes

[Any specific guidance for implementation teams]

## References

- [Link to related RFCs, issues, or documentation]
- [ICN specifications referenced]
- [External standards or patterns used]

---
*This ADR follows ICN documentation standards and should be reviewed by relevant stakeholders before implementation.*`,
};

/**
 * Release notes prompt template for summarizing merged PRs since last tag
 */
export const releaseNotesPrompt: ICNPrompt = {
  name: 'release-notes',
  description: 'Generate release notes by summarizing merged PRs since the last tag',
  category: 'workflow',
  arguments: [
    {
      name: 'version',
      description: 'The version being released',
      required: true,
    },
    {
      name: 'lastTag',
      description: 'The previous release tag/version',
      required: true,
    },
    {
      name: 'prList',
      description: 'List of merged PRs since last tag',
      required: true,
    },
    {
      name: 'highlights',
      description: 'Key highlights or breaking changes',
      required: false,
    },
  ],
  template: `# Release Notes for {{version}}

## Overview
This release includes changes merged since {{lastTag}}.

{{#if highlights}}
## Highlights
{{highlights}}
{{/if}}

## Changes

### Merged Pull Requests
{{prList}}

## Categorized Changes

### 🚀 Features
[List new features and enhancements]

### 🐛 Bug Fixes  
[List bug fixes and corrections]

### 📚 Documentation
[List documentation updates]

### 🔧 Technical Improvements
[List refactoring, performance, and technical debt items]

### 🏛️ Governance & Policy
[List changes to governance, policies, or ICN protocol]

### ⚠️ Breaking Changes
[List any breaking changes that require user action]

## ICN Protocol Updates
[If applicable, describe any changes to ICN surfaces, invariants, or core protocols]

## Migration Guide
[If needed, provide guidance for upgrading from previous version]

## Dependencies
[List any new or updated dependencies]

## Contributors
[Acknowledge contributors to this release]

---

**Full Changelog:** https://github.com/InterCooperative-Network/icn-mcp/compare/{{lastTag}}...{{version}}

*This release maintains ICN invariants and cooperative principles.*`,
};

/**
 * All available ICN prompt templates
 */
export const ICN_PROMPTS: ICNPrompt[] = [
  codeReviewPrompt,
  adrTemplatePrompt,
  releaseNotesPrompt,
];

/**
 * Get a prompt template by name
 */
export function getPromptByName(name: string): ICNPrompt | undefined {
  return ICN_PROMPTS.find(prompt => prompt.name === name);
}

/**
 * Get all prompts in a specific category
 */
export function getPromptsByCategory(category: 'workflow' | 'documentation' | 'review'): ICNPrompt[] {
  return ICN_PROMPTS.filter(prompt => prompt.category === category);
}