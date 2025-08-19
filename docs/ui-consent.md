# User Interface and Consent Features

The ICN MCP server implements user interface and consent features to ensure transparency and user control over tool execution, aligning with the MCP specification's user interaction model.

## Overview

The UI and consent system provides:

1. **Tool Discovery**: Display available tools with descriptions and risk levels
2. **User Consent**: Request explicit permission before executing impactful actions
3. **Progress Reporting**: Provide real-time updates during tool execution
4. **Transparency**: Show what actions will be performed and their potential impact

## Core Components

### Consent Manager

The `ConsentManager` class handles consent logic and configuration:

```typescript
import { ConsentManager } from 'icn-mcp/consent';

const manager = new ConsentManager({
  requireConsentForAll: false,
  alwaysRequireConsent: ['icn_write_patch', 'icn_run_tests'],
  neverRequireConsent: ['icn_get_architecture', 'icn_check_policy'],
  consentTimeoutSeconds: 300
});
```

### New MCP Tools

#### `icn_display_tools`
Display available tools with categorization and risk information:

```json
{
  "name": "icn_display_tools",
  "arguments": {
    "category": "development"  // Optional filter
  }
}
```

Response includes:
- Tool descriptions and categories
- Risk levels (low/medium/high)
- Required/optional parameters
- Usage examples
- Consent requirements

#### `icn_request_consent`
Request user consent before tool execution:

```json
{
  "name": "icn_request_consent", 
  "arguments": {
    "toolName": "icn_write_patch",
    "toolArgs": { "files": ["src/test.ts"] },
    "context": "Updating test file based on review feedback"
  }
}
```

Response includes:
- Formatted consent prompt
- Risk assessment
- Impact analysis (files to read/modify, external calls)
- Unique request ID for tracking

#### `icn_report_progress`
Report execution progress for transparency:

```json
{
  "name": "icn_report_progress",
  "arguments": {
    "toolName": "icn_run_tests",
    "phase": "execution",
    "progress": 75,
    "message": "Running integration tests..."
  }
}
```

Response includes:
- Formatted progress display with visual progress bar
- Timestamp and phase information
- Completion status

## Risk Assessment

Tools are automatically categorized by risk level:

### 🟢 Low Risk
- Read-only operations (e.g., `icn_get_architecture`)
- No file modifications or external calls
- Safe for automatic execution

### 🟡 Medium Risk  
- Policy checks and validations
- Temporary state modifications
- May require user awareness

### 🔴 High Risk
- File modifications (`icn_write_patch`)
- External API calls (`icn_generate_pr_patch`)
- Command execution (`icn_run_tests`)
- Requires explicit user consent

## Integration with MCP Clients

### GitHub Copilot Integration

The consent system integrates seamlessly with GitHub Copilot:

1. **Tool Discovery**: Use `icn_display_tools` to show available capabilities
2. **Consent Prompts**: Display formatted prompts in chat interface
3. **Progress Updates**: Stream real-time progress during execution

Example workflow:
```
User: "Help me run tests for my changes"

Copilot: Uses icn_display_tools to show testing options
         Uses icn_request_consent to get permission
         Uses icn_report_progress during execution
```

### Claude Desktop Integration

Similar integration patterns apply for Claude Desktop and other MCP clients.

## Consent Prompts

The system includes standardized prompts for user interaction:

- **tool_consent_request**: Request permission with risk assessment
- **tool_progress_update**: Display execution progress  
- **tools_display**: Show available tools and categories
- **consent_denied**: Handle consent rejection gracefully
- **consent_approved**: Confirm consent approval

## Configuration

Consent behavior can be configured per deployment:

```json
{
  "requireConsentForAll": false,
  "alwaysRequireConsent": [
    "icn_write_patch",
    "icn_generate_pr_patch",
    "icn_run_tests",
    "icn_run_linters"
  ],
  "neverRequireConsent": [
    "icn_get_architecture", 
    "icn_get_invariants",
    "icn_check_policy",
    "icn_get_task_context"
  ],
  "consentTimeoutSeconds": 300,
  "logConsentDecisions": true
}
```

## Best Practices

### For MCP Client Developers

1. **Show Tool Information**: Use `icn_display_tools` to help users understand capabilities
2. **Request Consent**: Use `icn_request_consent` for transparent permission requests
3. **Display Progress**: Use `icn_report_progress` for long-running operations
4. **Handle Rejections**: Gracefully handle consent denials with alternatives

### For Users

1. **Review Consent Prompts**: Read risk assessments and impact details
2. **Understand Tool Categories**: Learn the purpose of different tool types
3. **Monitor Progress**: Watch progress updates for transparency
4. **Provide Feedback**: Use consent messages to guide tool behavior

## Compliance

This implementation aligns with:

- **MCP Specification**: User interaction model and security guidelines
- **ICN Principles**: Transparency, democratic control, user agency
- **Security Best Practices**: Explicit consent for impactful actions

## Future Enhancements

Planned improvements include:

- Persistent consent preferences
- Role-based consent requirements
- Integration with ICN governance mechanisms
- Enhanced progress visualization
- Audit logging and compliance reporting