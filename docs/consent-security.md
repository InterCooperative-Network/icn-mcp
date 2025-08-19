# Consent and Security Documentation

## Overview

The ICN MCP server implements comprehensive user consent and security features to ensure transparency, user control, and compliance with MCP specification requirements.

## Risk Assessment Framework

### Risk Level Definitions

- **🟢 Low Risk**: Read-only operations with no mutations or external dependencies
  - Examples: `icn_get_architecture`, `icn_get_invariants`
  - Auto-approved by default
  - No user consent required

- **🟡 Medium Risk**: Evaluations, validations, and simulations with no persistent writes
  - Examples: `icn_check_policy`, `icn_validate_workflow`, `icn_simulate_economy`
  - May require consent based on configuration
  - Safe to execute but may consume resources

- **🔴 High Risk**: File I/O, network calls, and persistent state changes
  - Examples: `icn_write_patch`, `icn_run_tests`, `icn_generate_pr_patch`
  - Always requires explicit user consent
  - Potential for system modification or external impact

## Consent Logging Policy

### What is Logged

The consent system logs the following information when `logConsentDecisions` is enabled:

- **Request Details**:
  - Tool name and description
  - Risk level assessment
  - Files to be read/modified
  - External API calls planned
  - Estimated execution time

- **User Response**:
  - Approval/denial decision
  - Optional user message or instructions
  - Timestamp of decision
  - Request ID for tracking

### Data Security

- **Local Storage**: Consent logs are stored locally in the MCP server process memory
- **No External Transmission**: Consent decisions are never transmitted to external services
- **Session Scope**: Logs are cleared when the MCP server restarts
- **Access Control**: Only the local user running the MCP server can access consent logs

### Audit Trail

Consent decisions are logged to the console with the format:
```
[CONSENT] {toolName}: {APPROVED|DENIED} at {timestamp}
```

This provides an audit trail for security review and debugging purposes.

## Runtime Configuration

### Environment Variables

The consent system can be configured at runtime using environment variables:

```bash
# Require consent for all tools (overrides default risk assessment)
ICN_CONSENT_REQUIRE_ALL=true

# Custom consent timeout (seconds)
ICN_CONSENT_TIMEOUT=600

# Tools that always require consent (comma-separated)
ICN_CONSENT_ALWAYS_REQUIRE="icn_write_patch,icn_custom_tool"

# Tools that never require consent (comma-separated)
ICN_CONSENT_NEVER_REQUIRE="icn_get_architecture,icn_check_policy"

# Disable consent logging
ICN_CONSENT_LOG=false
```

### Programmatic Configuration

```typescript
const consentManager = new ConsentManager({
  requireConsentForAll: false,
  alwaysRequireConsent: ['icn_write_patch', 'icn_run_tests'],
  neverRequireConsent: ['icn_get_architecture'],
  consentTimeoutSeconds: 300,
  logConsentDecisions: true
});
```

## User Experience Guidelines

### Consent Prompts

Consent prompts include:
- Clear tool identification and description
- Risk level with visual indicators (🟢🟡🔴)
- Estimated execution time
- Files that will be accessed or modified
- External APIs that will be called
- Timeout warning with auto-denial policy

### Progress Updates

Progress reporting supports:
- Visual progress bars with percentage completion
- Status indicators (✅⚠️❌ℹ️)
- Error handling with recovery information
- Detailed execution phases
- Additional context and debugging information

### Client Integration

#### GitHub Copilot
- Consent prompts display in chat interface
- Progress updates show as formatted messages
- Rich formatting with emojis and progress bars

#### Claude Desktop
- Similar formatting for consistency
- Markdown rendering for structured display

## Security Best Practices

### Timeout Handling

- **Default Timeout**: 5 minutes for user response
- **Auto-Denial**: Requests timeout to denial for security
- **User Warning**: Timeout policy clearly communicated in prompts

### Error Recovery

- **Partial Failures**: Progress reporting handles execution errors
- **Recovery Guidance**: Errors indicate if recovery is possible
- **Status Tracking**: Clear indication of success/warning/error states

### Access Control

- **Explicit Consent**: High-risk operations always require user approval
- **Granular Control**: Per-tool consent configuration
- **Override Protection**: Environment variables cannot override security-critical settings

## Compliance

### MCP Specification Alignment

- **User Interaction Model**: Implements MCP user interaction guidelines
- **Transparency**: Complete visibility into tool capabilities and actions
- **User Agency**: User maintains control over all tool execution

### ICN Principles

- **Democratic Control**: Users have final authority over tool execution
- **Transparency**: All tool capabilities and risks clearly documented
- **Security**: Defense-in-depth approach with multiple safeguards

## Integration Examples

### Tool Discovery

```json
{
  "tools": [
    {
      "name": "icn_write_patch",
      "description": "Write or patch a file with policy enforcement",
      "category": "development",
      "riskLevel": "high",
      "requiresConsent": true,
      "example": "icn_write_patch({ files: [\"src/example.ts\"], content: \"export class Example {}\" })"
    }
  ]
}
```

### Consent Request

```json
{
  "prompt": "## Tool Execution Request 🔴\n\n**Tool:** icn_write_patch...",
  "requestId": "consent_1234567890_abc123",
  "instructions": "Please review the above information and confirm..."
}
```

### Progress Update

```json
{
  "formatted": "## Progress Update ⚠️\n\n**Progress:** [███████░░░] 75%\n**Status:** Tests failed at step 2/5",
  "isComplete": false,
  "error": {
    "code": "TEST_FAILURE",
    "message": "Integration tests failed",
    "recoverable": true
  }
}
```

This documentation ensures users understand the security model, data handling practices, and integration patterns for the ICN MCP consent system.