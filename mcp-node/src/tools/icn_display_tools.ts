/**
 * Tool to display available ICN MCP tools with descriptions and usage information
 * Provides transparency about available capabilities
 */

import { ConsentManager } from '../consent/index.js';

export interface DisplayToolsResponse {
  tools: Array<{
    name: string;
    description: string;
    category: string;
    riskLevel: string;
    requiredParams: string[];
    optionalParams: string[];
    example?: string;
    requiresConsent: boolean;
  }>;
  totalCount: number;
  categories: string[];
}

/**
 * Display all available ICN MCP tools with detailed information
 */
export async function icnDisplayTools(args?: { category?: string }): Promise<DisplayToolsResponse> {
  const consentManager = new ConsentManager();
  const allTools = consentManager.getToolsDisplay();
  
  // Filter by category if specified
  const filteredTools = args?.category 
    ? allTools.filter(tool => tool.category === args.category)
    : allTools;
  
  // Add consent requirement information
  const toolsWithConsent = filteredTools.map(tool => ({
    ...tool,
    requiresConsent: consentManager.requiresConsent(tool.name)
  }));
  
  // Get unique categories
  const categories = [...new Set(allTools.map(tool => tool.category))].sort();
  
  return {
    tools: toolsWithConsent,
    totalCount: toolsWithConsent.length,
    categories
  };
}