/**
 * Tool to request user consent before executing actions
 * Implements MCP specification user interaction model
 */

import { ConsentManager, ConsentRequest, ConsentResponse } from '../consent/index.js';

export interface RequestConsentArgs {
  /** Tool name requesting consent */
  toolName: string;
  /** Tool arguments for analysis */
  toolArgs?: any;
  /** Additional context or reason */
  context?: string;
}

export interface RequestConsentResponse {
  /** The consent request details */
  request: ConsentRequest;
  /** Formatted prompt for user */
  prompt: string;
  /** Instructions for providing consent */
  instructions: string;
  /** Unique request ID for tracking */
  requestId: string;
}

/**
 * Request user consent for tool execution
 * Returns a formatted prompt that MCP clients can display to users
 */
export async function icnRequestConsent(args: RequestConsentArgs): Promise<RequestConsentResponse> {
  if (!args.toolName) {
    throw new Error('toolName is required');
  }
  
  const consentManager = new ConsentManager();
  
  // Create consent request
  const request = consentManager.createConsentRequest(args.toolName, args.toolArgs);
  
  // Generate formatted prompt
  let prompt = consentManager.createConsentPrompt(request);
  
  // Add context if provided
  if (args.context) {
    prompt += `\n\n**Additional Context:** ${args.context}`;
  }
  
  // Generate unique request ID
  const requestId = `consent_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  
  return {
    request,
    prompt,
    instructions: 'Please review the above information and confirm whether you want to proceed. This ensures transparency and user control over tool execution as required by the MCP specification.',
    requestId
  };
}

export async function icnProcessConsent(args: {
  requestId: string;
  approved: boolean;
  message?: string;
  userId?: string;
  toolName?: string;
  resource?: string;
  expiresAt?: string;
}): Promise<ConsentResponse> {
  const normalized = {
    ...args,
    message: args.approved ? (args.message ?? 'Approved') : (args.message ?? 'User denied request'),
  };

  const response: ConsentResponse = {
    approved: normalized.approved,
    message: normalized.message,
    timestamp: new Date().toISOString(),
    userId: args.userId,
    expiresAt: args.expiresAt
  };
  
  // Persist the decision if we have enough information
  if (args.userId && args.toolName) {
    const consentManager = new ConsentManager();
    const riskLevel = consentManager.assessRiskLevel(args.toolName, {});
    
    try {
      const persistedDecision = consentManager.persistConsent(
        args.userId,
        args.toolName,
        args.resource ?? undefined,
        response,
        riskLevel
      );
      
      console.log(`[CONSENT] Persisted decision for ${args.userId}/${args.toolName}: ${args.approved ? 'APPROVED' : 'DENIED'}`);
      console.log(`[CONSENT] Decision ID: ${persistedDecision.id}`);
    } catch (error) {
      console.error(`[CONSENT] Failed to persist decision:`, error);
    }
  }
  
  console.log(`[CONSENT] Request ${args.requestId}: ${args.approved ? 'APPROVED' : 'DENIED'}`);
  
  return response;
}