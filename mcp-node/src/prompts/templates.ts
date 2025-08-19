import { ICNPrompt } from './types.js';
import { consentPrompts } from './consent.js';

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
 * Governance proposal prompt template for democratic decision making
 */
export const governanceProposalPrompt: ICNPrompt = {
  name: 'governance-proposal',
  description: 'Template for creating governance proposals following ICN democratic principles',
  category: 'governance',
  arguments: [
    {
      name: 'title',
      description: 'The title of the governance proposal',
      required: true,
    },
    {
      name: 'proposer',
      description: 'Name or identifier of the proposal author',
      required: true,
    },
    {
      name: 'summary',
      description: 'Brief summary of the proposal',
      required: false,
    },
    {
      name: 'federationScope',
      description: 'Which federations this proposal affects (all, specific, local)',
      required: false,
    },
    {
      name: 'economicImpact',
      description: 'Whether this proposal has economic/mana allocation implications',
      required: false,
    },
  ],
  template: `# Governance Proposal: {{title}}

**Proposer:** {{proposer}}
**Date:** {{currentDate}}
**Status:** Draft
{{#if federationScope}}**Scope:** {{federationScope}}{{/if}}

## Summary

{{#if summary}}
{{summary}}
{{else}}
[Provide a concise summary of what this proposal aims to achieve and why it matters for the ICN community]
{{/if}}

## Background & Context

[Describe the current situation, problem, or opportunity this proposal addresses. Include:]
- Current state and any limitations
- Why change is needed now
- Impact on community members and federations
- Related previous discussions or decisions

## Proposal Details

### What is being proposed?
[Detailed description of the proposed change, policy, or action]

### How will this be implemented?
[Implementation plan, timeline, and required resources]

### Who is responsible?
[Roles and responsibilities for implementation and oversight]

{{#if economicImpact}}
## Economic Impact Assessment

### Mana/Coordination Credit Effects
[Describe how this proposal affects mana allocation, coordination credits, or economic incentives]

### Federation Impact
[How will this affect different federations' resources and capabilities?]

### Sustainability Considerations
[Long-term economic sustainability and implications]
{{/if}}

## ICN Principle Alignment

This proposal maintains ICN core principles:

- [ ] **Democratic Governance**: Decision made through proper democratic processes
- [ ] **Event-Sourced**: Changes are recorded as immutable events
- [ ] **Deterministic**: Outcomes are predictable and reproducible
- [ ] **Non-Transferable Credits**: Coordination credits remain personal/non-tradeable
- [ ] **Anti-Token-Voting**: No mechanisms that allow wealth-based voting power
- [ ] **Federation Autonomy**: Respects individual federation sovereignty
- [ ] **Cooperative Values**: Enhances mutual aid and collective benefit

## Voting Process

### Eligibility
[Who is eligible to vote on this proposal - all members, specific federations, affected parties only?]

### Timeline
- **Discussion Period:** [X days for community input and refinement]
- **Voting Period:** [X days for formal voting]
- **Implementation:** [Timeline if proposal passes]

### Voting Mechanism
[Specify the democratic voting mechanism to be used:]
- Simple majority
- Consensus required
- Supermajority threshold
- Federation-weighted voting
- Other: [specify]

### Success Criteria
[What constitutes passage - percentage needed, quorum requirements, etc.]

## Discussion Topics

[Key questions for community discussion:]

1. [Question about implementation details]
2. [Question about potential concerns]
3. [Question about alternative approaches]

## Alternatives Considered

[Other approaches that were considered and why this proposal is preferred]

## Risks & Mitigation

### Potential Risks
- [Risk 1 and mitigation strategy]
- [Risk 2 and mitigation strategy]

### Contingency Plans
[What happens if implementation faces unexpected challenges]

## Community Input

[Space for community members to provide feedback, concerns, and suggestions]

---

## Proposal History

- **[Date]**: Initial proposal drafted
- **[Date]**: Community feedback period begins
- **[Date]**: Proposal refined based on input
- **[Date]**: Voting begins
- **[Date]**: Decision finalized

---

**Next Steps:**
1. Community review and discussion
2. Address feedback and refine proposal
3. Formal voting process
4. Implementation if approved

*This proposal follows ICN democratic governance standards and respects federation autonomy while advancing cooperative principles.*`,
};

/**
 * All available ICN prompt templates
 */
export const ICN_PROMPTS: ICNPrompt[] = [
  codeReviewPrompt,
  adrTemplatePrompt,
  releaseNotesPrompt,
  governanceProposalPrompt,
  ...consentPrompts,
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
export function getPromptsByCategory(category: 'workflow' | 'documentation' | 'review' | 'governance'): ICNPrompt[] {
  return ICN_PROMPTS.filter(prompt => prompt.category === category);
}