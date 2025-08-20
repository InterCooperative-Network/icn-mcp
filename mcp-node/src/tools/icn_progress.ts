/**
 * Tool to provide progress updates during tool execution
 * Enhances transparency and user awareness
 */

import { ConsentManager, ProgressUpdate } from '../consent/index.js';

export interface ProgressArgs {
  /** Tool name */
  toolName: string;
  /** Current phase of execution */
  phase: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current status message */
  message: string;
  /** Additional details */
  details?: any;
  /** Status type: success, warning, error, info */
  status?: 'success' | 'warning' | 'error' | 'info';
  /** Error information for failures */
  error?: {
    code?: string;
    message: string;
    recoverable?: boolean;
  };
}

export interface ProgressResponse {
  /** The progress update */
  update: ProgressUpdate;
  /** Formatted progress message */
  formatted: string;
  /** Whether execution is complete */
  isComplete: boolean;
}

/**
 * Report progress during tool execution
 */
export async function icnReportProgress(args: ProgressArgs): Promise<ProgressResponse> {
  if (!args?.toolName || typeof args.toolName !== 'string') {
    throw new Error('toolName parameter is required and must be a string');
  }
  if (typeof args?.progress !== 'number') {
    throw new Error('progress parameter is required and must be a number');
  }
  if (!args?.message || typeof args.message !== 'string') {
    throw new Error('message parameter is required and must be a string');
  }
  
  const consentManager = new ConsentManager();
  
  // Create progress update
  const update = consentManager.createProgressUpdate(
    args.toolName,
    args.phase || 'executing',
    Math.min(100, Math.max(0, args.progress)),
    args.message || 'In progress...',
    args.status,
    args.error
  );
  
  // Format progress message
  const clampedProgress = Math.min(100, Math.max(0, args.progress));
  const progressBar = '█'.repeat(Math.floor(clampedProgress / 10)) + 
                     '░'.repeat(10 - Math.floor(clampedProgress / 10));
  
  // Status emoji based on status type
  const statusEmoji = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: 'ℹ️'
  }[args.status || 'info'];

  let formatted = `## Progress Update ${statusEmoji}\n\n`;
  formatted += `**Tool:** ${args.toolName}\n`;
  formatted += `**Phase:** ${args.phase || 'executing'}\n`;
  formatted += `**Progress:** [${progressBar}] ${clampedProgress}%\n`;
  formatted += `**Status:** ${args.message}\n`;
  formatted += `**Time:** ${update.timestamp}\n`;
  
  // Add error information if present
  if (args.error) {
    formatted += `\n**Error Details:**\n`;
    formatted += `- **Code:** ${args.error.code || 'UNKNOWN'}\n`;
    formatted += `- **Message:** ${args.error.message}\n`;
    formatted += `- **Recoverable:** ${args.error.recoverable ? 'Yes' : 'No'}\n`;
  }

  if (args.details) {
    formatted += `\n**Additional Details:**\n`;
    formatted += `\`\`\`json\n${JSON.stringify(args.details, null, 2)}\n\`\`\`\n`;
  }
  
  const isComplete = args.progress >= 100;
  const hasFailed = args.status === 'error' || args.error;
  
  if (isComplete && !hasFailed) {
    formatted += `\n✅ **Execution Complete**`;
  } else if (hasFailed) {
    formatted += `\n❌ **Execution ${isComplete ? 'Failed' : 'Encountered Error'}**`;
    if (args.error?.recoverable) {
      formatted += ` (Recovery possible)`;
    }
  }
  
  // Log progress
  console.log(`[PROGRESS] ${args.toolName}: ${args.progress}% - ${args.message}`);
  
  return {
    update,
    formatted,
    isComplete
  };
}

/**
 * Get recent progress updates for a tool
 */
export async function icnGetProgressHistory(_args: { toolName?: string; limit?: number }) {
  // In a real implementation, this would retrieve from a persistent store
  // For now, return a mock response showing the capability
  
  return {
    updates: [],
    message: 'Progress history would be retrieved from persistent storage',
    note: 'This is a demonstration of progress tracking capability'
  };
}