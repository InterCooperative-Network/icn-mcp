# UI and Consent Features - Integration Example

This document demonstrates how the new UI and consent features integrate with GitHub Copilot and other MCP clients.

## Quick Start

1. **Start the MCP server:**
   ```bash
   npm run mcp-server
   ```

2. **In GitHub Copilot, discover available tools:**
   ```
   Use icn_display_tools to show me what ICN capabilities are available
   ```

3. **Request consent for a potentially impactful action:**
   ```
   Use icn_request_consent to ask permission before modifying files with icn_write_patch
   ```

4. **Monitor progress during execution:**
   ```
   Use icn_report_progress to show execution status during long-running operations
   ```

## Example Interactions

### Tool Discovery
**User:** "What ICN tools are available for development work?"

**Copilot response using icn_display_tools:**
```json
{
  "tools": [
    {
      "name": "icn_write_patch",
      "description": "Write or patch a file with policy enforcement",
      "category": "development",
      "riskLevel": "high",
      "requiresConsent": true,
      "example": "icn_write_patch({ files: ['src/test.ts'] })"
    }
  ],
  "totalCount": 26,
  "categories": ["architecture", "development", "governance", "policy"]
}
```

### Consent Request
**User:** "I want to modify a test file to add new functionality"

**Copilot using icn_request_consent:**
```json
{
  "request": {
    "toolName": "icn_write_patch",
    "description": "Write or patch a file with policy enforcement",
    "details": {
      "riskLevel": "high",
      "filesToModify": ["src/test.ts"],
      "estimatedTime": "< 30 seconds"
    }
  },
  "prompt": "## Tool Execution Request 🔴\n\n**Tool:** icn_write_patch\n**Description:** Write or patch a file with policy enforcement\n**Risk Level:** high\n...",
  "requestId": "consent_1234567890_abc123"
}
```

**User response:** "Yes, please proceed"

### Progress Updates
**During execution, Copilot uses icn_report_progress:**
```json
{
  "update": {
    "toolName": "icn_write_patch",
    "phase": "validation",
    "progress": 25,
    "message": "Validating file permissions and policy compliance"
  },
  "formatted": "## Progress Update\n\n**Tool:** icn_write_patch\n**Progress:** [██░░░░░░░░] 25%\n**Status:** Validating file permissions..."
}
```

## Benefits

### For Users
- **Transparency**: Clear visibility into what tools will do
- **Control**: Explicit consent for impactful operations
- **Progress**: Real-time updates during execution
- **Safety**: Risk assessment prevents accidental damage

### For Developers
- **Compliance**: Meets MCP specification requirements
- **Integration**: Works with existing MCP clients
- **Flexibility**: Configurable consent policies
- **Extensibility**: Easy to add new tools with consent support

## Configuration

Consent behavior can be customized:

```typescript
const consentManager = new ConsentManager({
  requireConsentForAll: false,
  alwaysRequireConsent: ['icn_write_patch', 'icn_run_tests'],
  neverRequireConsent: ['icn_get_architecture'],
  consentTimeoutSeconds: 300
});
```

This creates a transparent, user-controlled environment that respects both user agency and system security.