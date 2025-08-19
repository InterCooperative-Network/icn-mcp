/**
 * User consent manager for ICN MCP server
 * Handles user consent requests and configuration
 */

import { ConsentRequest, ConsentResponse, ConsentConfiguration, ProgressUpdate, ToolDisplay } from './types.js';
import { generateToolManifest } from '../manifest.js';

export class ConsentManager {
  private config: ConsentConfiguration;
  private consentLog: Array<ConsentRequest & ConsentResponse> = [];

  constructor(config?: Partial<ConsentConfiguration>) {
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
    prompt += `Type 'yes' to approve, 'no' to deny, or provide additional instructions.`;
    
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
  createProgressUpdate(toolName: string, phase: string, progress: number, message: string): ProgressUpdate {
    return {
      toolName,
      phase,
      progress,
      message,
      timestamp: new Date().toISOString()
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

  // Private helper methods

  private getToolInfo(toolName: string) {
    const manifest = generateToolManifest();
    return manifest.find(t => t.name === toolName) || { 
      name: toolName, 
      description: 'Unknown tool' 
    };
  }

  private assessRiskLevel(toolName: string, _args: any): 'low' | 'medium' | 'high' {
    // High risk tools that modify files or run commands
    if (toolName.includes('write') || toolName.includes('patch') || 
        toolName.includes('run') || toolName.includes('generate_pr')) {
      return 'high';
    }
    
    // Medium risk tools that check policies or modify state
    if (toolName.includes('check') || toolName.includes('workflow') ||
        toolName.includes('orchestrate')) {
      return 'medium';
    }
    
    // Low risk tools that only read data
    return 'low';
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
      'icn_workflow': 'icn_workflow({ intent: "Add new MCP tool for file analysis" })'
    };
    
    return examples[toolName];
  }
}