/**
 * User consent and interaction types for ICN MCP server
 * Implements user interaction model from MCP specification
 */

export interface ConsentRequest {
  /** Tool name requesting consent */
  toolName: string;
  /** Human-readable description of what the tool will do */
  description: string;
  /** Detailed information about the action */
  details: {
    /** Files that will be read */
    filesToRead?: string[];
    /** Files that will be modified */
    filesToModify?: string[];
    /** External APIs that will be called */
    externalCalls?: string[];
    /** Estimated execution time */
    estimatedTime?: string;
    /** Risk level */
    riskLevel: 'low' | 'medium' | 'high';
  };
  /** Required for consent */
  requiredApproval: boolean;
}

export interface ConsentResponse {
  /** Whether user granted consent */
  approved: boolean;
  /** Optional user message */
  message?: string;
  /** Timestamp of decision */
  timestamp: string;
}

export interface ProgressUpdate {
  /** Tool name */
  toolName: string;
  /** Current phase */
  phase: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current status message */
  message: string;
  /** Timestamp of update */
  timestamp: string;
}

export interface ConsentConfiguration {
  /** Whether consent is required for all tools */
  requireConsentForAll: boolean;
  /** Tools that always require consent */
  alwaysRequireConsent: string[];
  /** Tools that never require consent */
  neverRequireConsent: string[];
  /** Default consent timeout in seconds */
  consentTimeoutSeconds: number;
  /** Whether to log all consent decisions */
  logConsentDecisions: boolean;
}

export interface ToolDisplay {
  /** Tool name */
  name: string;
  /** Human-readable description */
  description: string;
  /** Category */
  category: 'architecture' | 'policy' | 'workflow' | 'development' | 'governance' | 'economics';
  /** Risk level */
  riskLevel: 'low' | 'medium' | 'high';
  /** Required parameters */
  requiredParams: string[];
  /** Optional parameters */
  optionalParams: string[];
  /** Example usage */
  example?: string;
}