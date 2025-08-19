/**
 * User consent prompts for ICN MCP server
 * Provides standardized prompts for user consent and tool transparency
 */

import { ICNPrompt } from './types.js';

export const consentPrompts: ICNPrompt[] = [
  {
    name: 'tool_consent_request',
    description: 'Request user consent before executing a tool with potential impact',
    category: 'workflow',
    arguments: [
      { name: 'toolName', description: 'Name of the tool requesting consent', required: true },
      { name: 'description', description: 'Description of what the tool will do', required: true },
      { name: 'riskLevel', description: 'Risk level: low, medium, or high', required: true },
      { name: 'estimatedTime', description: 'Estimated execution time', required: false },
      { name: 'filesToRead', description: 'Files that will be read', required: false },
      { name: 'filesToModify', description: 'Files that will be modified', required: false },
      { name: 'externalCalls', description: 'External APIs that will be called', required: false },
      { name: 'context', description: 'Additional context for the request', required: false }
    ],
    template: `# Tool Execution Consent Request

{{#if riskLevel}}**Risk Level**: {{#if riskLevel}}🔴{{else}}{{#if riskLevel}}🟡{{else}}🟢{{/if}}{{/if}} {{riskLevel}}{{/if}}

## Tool Information
- **Name**: {{toolName}}
- **Description**: {{description}}
{{#if estimatedTime}}
- **Estimated Time**: {{estimatedTime}}
{{/if}}

{{#if filesToRead}}
## Files to Read
{{filesToRead}}
{{/if}}

{{#if filesToModify}}
## Files to Modify  
{{filesToModify}}
{{/if}}

{{#if externalCalls}}
## External API Calls
{{externalCalls}}
{{/if}}

{{#if context}}
## Additional Context
{{context}}
{{/if}}

## Consent Required

This tool requires your explicit consent before execution to ensure transparency and user control as specified in the MCP user interaction model.

**Options:**
- Type **"yes"** or **"approve"** to grant consent
- Type **"no"** or **"deny"** to refuse execution  
- Provide specific instructions or modifications

**Question**: Do you consent to executing this tool with the parameters described above?`
  },
  
  {
    name: 'tool_progress_update',
    description: 'Display tool execution progress to keep users informed',
    category: 'workflow', 
    arguments: [
      { name: 'toolName', description: 'Name of the executing tool', required: true },
      { name: 'phase', description: 'Current execution phase', required: true },
      { name: 'progress', description: 'Progress percentage (0-100)', required: true },
      { name: 'message', description: 'Current status message', required: true },
      { name: 'timeElapsed', description: 'Time elapsed since start', required: false },
      { name: 'timeRemaining', description: 'Estimated time remaining', required: false }
    ],
    template: `# {{toolName}} - Progress Update

## Current Status
- **Phase**: {{phase}}
- **Progress**: {{progress}}% 
- **Status**: {{message}}
- **Timestamp**: {{currentDate}}

{{#if timeElapsed}}
- **Time Elapsed**: {{timeElapsed}}
{{/if}}

{{#if timeRemaining}}  
- **Time Remaining**: {{timeRemaining}}
{{/if}}

## Progress Bar
[████████████████████████████████████████] {{progress}}%

{{#if progress}}{{#if progress}}{{#if progress}}✅ **Execution Complete**{{/if}}{{/if}}{{/if}}`
  },

  {
    name: 'tools_display',
    description: 'Display available tools with categories and risk information',
    category: 'documentation',
    arguments: [
      { name: 'category', description: 'Optional category filter', required: false },
      { name: 'riskLevel', description: 'Optional risk level filter', required: false },
      { name: 'showExamples', description: 'Whether to show usage examples', required: false }
    ],
    template: `# Available ICN MCP Tools

{{#if category}}
Filtered by category: **{{category}}**
{{/if}}

{{#if riskLevel}}
Filtered by risk level: **{{riskLevel}}**  
{{/if}}

## Tool Categories

### 🏗️ Architecture
Tools for getting architecture documentation and system design information.

### 🛡️ Policy  
Tools for checking policies, validating permissions, and ensuring compliance.

### ⚡ Workflow
Tools for orchestrating complex multi-step processes and automation.

### 👨‍💻 Development
Tools for code analysis, testing, linting, and development operations.

### 🏛️ Governance
Tools for voting mechanisms, governance flows, and decision-making processes.

### 📊 Economics
Tools for economic modeling, simulations, and settlement operations.

## Risk Levels

- 🟢 **Low Risk**: Read-only operations that don't modify state
- 🟡 **Medium Risk**: Operations that check policies or modify temporary state  
- 🔴 **High Risk**: Operations that modify files, run commands, or call external APIs

## Usage Guidelines

1. **Review tool descriptions** before use to understand their purpose and impact
2. **Check risk levels** to understand the potential impact of tool execution
3. **Provide consent** when prompted for medium and high-risk operations
4. **Monitor progress** during tool execution for transparency

{{#if showExamples}}
## Common Usage Patterns

- Start with **icn_display_tools** to see available capabilities
- Use **icn_get_architecture** to understand system design
- Check **icn_check_policy** before making changes
- Request **icn_request_consent** for transparent execution
{{/if}}`
  },

  {
    name: 'consent_denied',
    description: 'Message displayed when user denies consent for tool execution',
    category: 'workflow',
    arguments: [
      { name: 'toolName', description: 'Name of the tool that was denied', required: true },
      { name: 'reason', description: 'User-provided reason for denial', required: false },
      { name: 'alternatives', description: 'Suggested alternative approaches', required: false }
    ],
    template: `# Consent Denied

## Tool Execution Cancelled

The execution of **{{toolName}}** has been cancelled based on your decision.

{{#if reason}}
## Reason Provided
{{reason}}
{{/if}}

{{#if alternatives}}
## Suggested Alternatives
{{alternatives}}
{{/if}}

## Next Steps

You can:
- Review the tool description and try again
- Use **icn_display_tools** to find alternative tools
- Modify the parameters and request consent again
- Contact support if you need assistance

Your consent is important for maintaining transparency and control over tool execution.`
  },

  {
    name: 'consent_approved',
    description: 'Confirmation message when user approves tool execution',
    category: 'workflow',
    arguments: [
      { name: 'toolName', description: 'Name of the approved tool', required: true },
      { name: 'userMessage', description: 'Any additional message from user', required: false },
      { name: 'requestId', description: 'Consent request ID for tracking', required: false }
    ],
    template: `# Consent Approved ✅

## Tool Execution Authorized

You have approved the execution of **{{toolName}}**.

{{#if requestId}}
**Request ID**: {{requestId}}
{{/if}}

{{#if userMessage}}
## Your Message
{{userMessage}}
{{/if}}

## Next Steps

The tool will now execute with the parameters you reviewed. You will receive progress updates during execution to maintain transparency.

**Timestamp**: {{currentDate}}

Thank you for your consent. Execution will begin shortly.`
  }
];