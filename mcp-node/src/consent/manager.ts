/**
 * User consent manager for ICN MCP server
 * Handles user consent requests and configuration
 */

import { ConsentRequest, ConsentResponse, ConsentConfiguration, ProgressUpdate, ToolDisplay, PersistedConsentDecision } from './types.js';
import { generateToolManifest } from '../manifest.js';
import { 
  persistConsentDecision, 
  checkPersistedConsent, 
  revokeConsent, 
  getUserConsentHistory,
  cleanupExpiredConsent 
} from './persistence.js';

export class ConsentManager {
  private config: ConsentConfiguration;
  private consentLog: Array<ConsentRequest & ConsentResponse> = [];

  constructor(config?: Partial<ConsentConfiguration>) {
    // Load configuration from environment variables if available
    const envConfig = this.loadEnvironmentConfig();
    
    this.config = {
      requireConsentForAll: false,
      alwaysRequireConsent: [
        'icn_write_patch',
        'icn_generate_pr_patch', 
        'icn_run_tests',
        'icn_run_linters'
      ],
      neverRequireConsent: [
        'icn_get_architecture',
        'icn_get_invariants',
        'icn_check_policy',
        'icn_get_task_context'
      ],
      consentTimeoutSeconds: 300, // 5 minutes
      logConsentDecisions: true,
      ...envConfig,
      ...config
    };
  }

  /**
   * Check if a tool requires user consent
   */
  requiresConsent(toolName: string): boolean {
    if (this.config.neverRequireConsent.includes(toolName)) {
      return false;
    }
    
    if (this.config.alwaysRequireConsent.includes(toolName)) {
      return true;
    }
    
    return this.config.requireConsentForAll;
  }

  /**
   * Create a consent request for a tool
   */
  createConsentRequest(toolName: string, args: any): ConsentRequest {
    const toolInfo = this.getToolInfo(toolName);
    const riskLevel = this.assessRiskLevel(toolName, args);
    
    return {
      toolName,
      description: toolInfo.description,
      details: {
        riskLevel,
        estimatedTime: this.estimateExecutionTime(toolName),
        ...this.analyzeArguments(toolName, args)
      },
      requiredApproval: this.requiresConsent(toolName)
    };
  }

  /**
   * Create a prompt for user consent
   */
  createConsentPrompt(request: ConsentRequest): string {
    const riskEmoji = {
      low: '🟢',
      medium: '🟡', 
      high: '🔴'
    }[request.details.riskLevel];

    let prompt = `## Tool Execution Request ${riskEmoji}\n\n`;
    prompt += `**Tool:** ${request.toolName}\n`;
    prompt += `**Description:** ${request.description}\n`;
    prompt += `**Risk Level:** ${request.details.riskLevel}\n`;
    
    if (request.details.estimatedTime) {
      prompt += `**Estimated Time:** ${request.details.estimatedTime}\n`;
    }
    
    if (request.details.filesToRead?.length) {
      prompt += `**Files to read:** ${request.details.filesToRead.join(', ')}\n`;
    }
    
    if (request.details.filesToModify?.length) {
      prompt += `**Files to modify:** ${request.details.filesToModify.join(', ')}\n`;
    }
    
    if (request.details.externalCalls?.length) {
      prompt += `**External calls:** ${request.details.externalCalls.join(', ')}\n`;
    }
    
    prompt += `\n**Do you want to proceed with this action?**\n`;
    prompt += `Type 'yes' to approve, 'no' to deny, or provide additional instructions.\n`;
    prompt += `\n*Note: If no response is provided within ${Math.floor(this.config.consentTimeoutSeconds / 60)} minutes, the request will be automatically denied for security.*`;
    
    return prompt;
  }

  /**
   * Log a consent decision
   */
  logConsent(request: ConsentRequest, response: ConsentResponse): void {
    if (this.config.logConsentDecisions) {
      this.consentLog.push({ ...request, ...response });
      console.log(`[CONSENT] ${request.toolName}: ${response.approved ? 'APPROVED' : 'DENIED'} at ${response.timestamp}`);
    }
  }

  /**
   * Check if consent has been granted for a tool and user
   */
  checkConsent(userId: string, toolName: string, resource?: string): PersistedConsentDecision | null {
    // Check persisted consent first
    const persistedConsent = checkPersistedConsent(userId, toolName, resource);
    if (persistedConsent) {
      return persistedConsent;
    }
    
    return null;
  }

  /**
   * Persist a consent decision to the database
   */
  persistConsent(
    userId: string,
    toolName: string,
    resource: string | undefined,
    response: ConsentResponse,
    riskLevel: 'low' | 'medium' | 'high'
  ): PersistedConsentDecision {
    // Calculate expiration if default is set
    let expiresAt: number | undefined;
    if (this.config.defaultExpirySeconds) {
      expiresAt = Math.floor(Date.now() / 1000) + this.config.defaultExpirySeconds;
    }
    if (response.expiresAt) {
      expiresAt = Math.floor(new Date(response.expiresAt).getTime() / 1000);
    }

    return persistConsentDecision(
      userId,
      toolName,
      resource,
      response.approved,
      response.message,
      riskLevel,
      expiresAt
    );
  }

  /**
   * Revoke consent for a tool and user
   */
  revokeConsentDecision(userId: string, toolName: string, resource?: string): boolean {
    return revokeConsent(userId, toolName, resource);
  }

  /**
   * Get consent history for a user
   */
  getConsentHistory(userId: string): PersistedConsentDecision[] {
    return getUserConsentHistory(userId);
  }

  /**
   * Check if a tool requires consent based on risk threshold and configuration
   */
  requiresConsentForUser(toolName: string, userId?: string, resource?: string): boolean {
    // Check if user has already given consent
    if (userId) {
      const existingConsent = this.checkConsent(userId, toolName, resource);
      if (existingConsent) {
        return !existingConsent.approved; // If denied, still require consent
      }
    }

    // Apply regular consent rules
    if (this.config.neverRequireConsent.includes(toolName)) {
      return false;
    }
    
    if (this.config.alwaysRequireConsent.includes(toolName)) {
      return true;
    }

    // Check risk threshold
    if (this.config.riskThreshold) {
      const riskLevel = this.assessRiskLevel(toolName, {});
      const riskLevels = ['low', 'medium', 'high'];
      const toolRiskIndex = riskLevels.indexOf(riskLevel);
      const thresholdIndex = riskLevels.indexOf(this.config.riskThreshold);
      
      if (toolRiskIndex >= thresholdIndex) {
        return true;
      }
    }
    
    return this.config.requireConsentForAll;
  }

  /**
   * Clean up expired consents
   */
  cleanupExpiredConsents(): number {
    return cleanupExpiredConsent();
  }

  /**
   * Get all available tools formatted for display
   */
  getToolsDisplay(): ToolDisplay[] {
    const manifest = generateToolManifest();
    
    return manifest.map(tool => ({
      name: tool.name,
      description: tool.description,
      category: this.categorizeType(tool.name),
      riskLevel: this.assessRiskLevel(tool.name, {}),
      requiredParams: this.getRequiredParams(tool),
      optionalParams: this.getOptionalParams(tool),
      example: this.getToolExample(tool.name)
    }));
  }

  /**
   * Create a progress update
   */
  createProgressUpdate(
    toolName: string, 
    phase: string, 
    progress: number, 
    message: string,
    status?: 'success' | 'warning' | 'error' | 'info',
    error?: { code?: string; message: string; recoverable?: boolean }
  ): ProgressUpdate {
    return {
      toolName,
      phase,
      progress,
      message,
      timestamp: new Date().toISOString(),
      status,
      error
    };
  }

  /**
   * Get consent log
   */
  getConsentLog(): Array<ConsentRequest & ConsentResponse> {
    return [...this.consentLog];
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ConsentConfiguration>): void {
    this.config = { ...this.config, ...updates };
  }

  // Public helper methods

  /**
   * Assess risk level for a tool
   */
  assessRiskLevel(toolName: string, _args: any): 'low' | 'medium' | 'high' {
    // Risk Level Definitions:
    // Low Risk: Read-only operations, no mutations, no external dependencies
    // Medium Risk: Evaluations, validations, simulations (no persistent writes)
    // High Risk: File I/O, network calls, persistent state changes
    
    // High risk tools that modify files or run commands
    if (toolName.includes('write') || toolName.includes('patch') || 
        toolName.includes('run') || toolName.includes('generate_pr') ||
        toolName.includes('create') || toolName.includes('delete') ||
        toolName.includes('modify') || toolName.includes('upload')) {
      return 'high';
    }
    
    // Medium risk tools that check policies, validate, or simulate
    if (toolName.includes('check') || toolName.includes('workflow') ||
        toolName.includes('orchestrate') || toolName.includes('validate') ||
        toolName.includes('simulate') || toolName.includes('analyze')) {
      return 'medium';
    }
    
    // Low risk tools that only read data
    return 'low';
  }

  // Private helper methods

  /**
   * Load configuration from environment variables
   */
  private loadEnvironmentConfig(): Partial<ConsentConfiguration> {
    const envConfig: Partial<ConsentConfiguration> = {};
    
    // ICN_CONSENT_REQUIRE_ALL: Require consent for all tools
    if (process.env.ICN_CONSENT_REQUIRE_ALL === 'true') {
      envConfig.requireConsentForAll = true;
    }
    
    // ICN_CONSENT_TIMEOUT: Consent timeout in seconds
    if (process.env.ICN_CONSENT_TIMEOUT) {
      const timeout = parseInt(process.env.ICN_CONSENT_TIMEOUT, 10);
      if (!isNaN(timeout) && timeout > 0) {
        envConfig.consentTimeoutSeconds = timeout;
      }
    }
    
    // ICN_CONSENT_ALWAYS_REQUIRE: Comma-separated list of tools that always require consent
    if (process.env.ICN_CONSENT_ALWAYS_REQUIRE) {
      envConfig.alwaysRequireConsent = process.env.ICN_CONSENT_ALWAYS_REQUIRE
        .split(',')
        .map(tool => tool.trim())
        .filter(tool => tool.length > 0);
    }
    
    // ICN_CONSENT_NEVER_REQUIRE: Comma-separated list of tools that never require consent
    if (process.env.ICN_CONSENT_NEVER_REQUIRE) {
      envConfig.neverRequireConsent = process.env.ICN_CONSENT_NEVER_REQUIRE
        .split(',')
        .map(tool => tool.trim())
        .filter(tool => tool.length > 0);
    }
    
    // ICN_CONSENT_LOG: Whether to log consent decisions
    if (process.env.ICN_CONSENT_LOG === 'false') {
      envConfig.logConsentDecisions = false;
    }
    
    // ICN_CONSENT_RISK_THRESHOLD: Risk threshold for automatic consent requirement
    if (process.env.ICN_CONSENT_RISK_THRESHOLD) {
      const threshold = process.env.ICN_CONSENT_RISK_THRESHOLD.toLowerCase();
      if (['low', 'medium', 'high'].includes(threshold)) {
        envConfig.riskThreshold = threshold as 'low' | 'medium' | 'high';
      }
    }
    
    // ICN_CONSENT_DEFAULT_EXPIRY: Default consent expiry in seconds
    if (process.env.ICN_CONSENT_DEFAULT_EXPIRY) {
      const expiry = parseInt(process.env.ICN_CONSENT_DEFAULT_EXPIRY, 10);
      if (!isNaN(expiry) && expiry > 0) {
        envConfig.defaultExpirySeconds = expiry;
      }
    }
    
    // ICN_CONSENT_STORAGE_PATH: Storage path for consent decisions
    if (process.env.ICN_CONSENT_STORAGE_PATH) {
      envConfig.storagePath = process.env.ICN_CONSENT_STORAGE_PATH;
    }
    
    return envConfig;
  }

  private getToolInfo(toolName: string) {
    const manifest = generateToolManifest();
    return manifest.find(t => t.name === toolName) || { 
      name: toolName, 
      description: 'Unknown tool' 
    };
  }

  private estimateExecutionTime(toolName: string): string {
    const timeEstimates: Record<string, string> = {
      'icn_run_tests': '1-5 minutes',
      'icn_run_linters': '30 seconds',
      'icn_generate_pr_patch': '2-10 minutes',
      'icn_workflow': '5-30 minutes',
      'icn_simulate_economy': '1-3 minutes'
    };
    
    return timeEstimates[toolName] || '< 30 seconds';
  }

  private analyzeArguments(toolName: string, _args: any): Partial<ConsentRequest['details']> {
    const result: Partial<ConsentRequest['details']> = {};
    
    // Analyze file-related arguments
    if (_args?.files) {
      result.filesToRead = Array.isArray(_args.files) ? _args.files : [_args.files];
    }
    
    if (_args?.changeset) {
      result.filesToModify = Array.isArray(_args.changeset) ? _args.changeset : [_args.changeset];
    }
    
    // Analyze external calls
    if (toolName.includes('pr') || toolName.includes('github')) {
      result.externalCalls = ['GitHub API'];
    }
    
    return result;
  }

  private categorizeType(toolName: string): ToolDisplay['category'] {
    if (toolName.includes('architecture')) return 'architecture';
    if (toolName.includes('policy')) return 'policy';
    if (toolName.includes('workflow')) return 'workflow';
    if (toolName.includes('test') || toolName.includes('lint') || toolName.includes('patch')) return 'development';
    if (toolName.includes('voting') || toolName.includes('governance')) return 'governance';
    if (toolName.includes('economic') || toolName.includes('simulate')) return 'economics';
    return 'development';
  }

  private getRequiredParams(tool: any): string[] {
    const required = tool.inputSchema?.required || [];
    return Array.isArray(required) ? required : [];
  }

  private getOptionalParams(tool: any): string[] {
    const properties = tool.inputSchema?.properties || {};
    const required = tool.inputSchema?.required || [];
    return Object.keys(properties).filter(key => !required.includes(key));
  }

  private getToolExample(toolName: string): string | undefined {
    const examples: Record<string, string> = {
      'icn_get_architecture': 'icn_get_architecture({ task: "implementing new agent capabilities" })',
      'icn_check_policy': 'icn_check_policy({ changeset: ["src/new-file.ts"], actor: "architect" })',
      'icn_workflow': 'icn_workflow({ intent: "Add new MCP tool for file analysis" })',
      'icn_write_patch': 'icn_write_patch({ files: ["src/example.ts"], content: "export class Example {}" })',
      'icn_run_tests': 'icn_run_tests({ testSuite: "unit", files: ["src/**/*.test.ts"] })',
      'icn_run_linters': 'icn_run_linters({ files: ["src/**/*.ts"], fix: true })',
      'icn_display_tools': 'icn_display_tools({ category: "development" })',
      'icn_request_consent': 'icn_request_consent({ toolName: "icn_write_patch", context: "Adding new feature" })',
      'icn_report_progress': 'icn_report_progress({ toolName: "icn_run_tests", progress: 50, message: "Running unit tests" })'
    };
    
    return examples[toolName];
  }
}