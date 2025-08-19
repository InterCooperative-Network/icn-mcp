import { PromptTemplate } from './types.js';
import { ICN_PROMPTS, getPromptByName } from './templates.js';

/**
 * Simple template interpolation using handlebars-like syntax
 * Supports {{variable}} and {{#if variable}}content{{/if}} patterns
 */
export function interpolateTemplate(template: string, variables: Record<string, any>): string {
  let result = template;
  
  // Handle conditional blocks with else first: {{#if variable}}content{{else}}alternative{{/if}}
  result = result.replace(/{{#if\s+(\w+)}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, (match, varName, ifContent, elseContent) => {
    const value = variables[varName];
    if (value && value !== '' && value !== null && value !== undefined) {
      return ifContent;
    }
    return elseContent;
  });
  
  // Handle conditional blocks without else: {{#if variable}}content{{/if}}
  result = result.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, varName, content) => {
    const value = variables[varName];
    if (value && value !== '' && value !== null && value !== undefined) {
      return content;
    }
    return '';
  });
  
  // Handle simple variable substitution: {{variable}}
  result = result.replace(/{{(\w+)}}/g, (match, varName) => {
    const value = variables[varName];
    return value !== undefined ? String(value) : match;
  });
  
  return result;
}

/**
 * Validate prompt arguments against template requirements
 */
export function validatePromptArguments(
  promptName: string, 
  providedArgs: Record<string, any>
): { valid: boolean; errors: string[] } {
  const prompt = getPromptByName(promptName);
  if (!prompt) {
    return { valid: false, errors: [`Prompt '${promptName}' not found`] };
  }
  
  const errors: string[] = [];
  
  // Check required arguments
  for (const arg of prompt.arguments) {
    if (arg.required && (providedArgs[arg.name] === undefined || providedArgs[arg.name] === '')) {
      errors.push(`Required argument '${arg.name}' is missing`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Generate a prompt from template with provided arguments
 */
export function generatePrompt(
  promptName: string,
  args: Record<string, any> = {}
): { success: boolean; content?: string; errors?: string[] } {
  const validation = validatePromptArguments(promptName, args);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }
  
  const prompt = getPromptByName(promptName);
  if (!prompt) {
    return { success: false, errors: [`Prompt '${promptName}' not found`] };
  }
  
  try {
    const content = interpolateTemplate(prompt.template, args);
    return { success: true, content };
  } catch (error) {
    return { 
      success: false, 
      errors: [`Template interpolation failed: ${error instanceof Error ? error.message : String(error)}`] 
    };
  }
}

/**
 * Get all available prompts with metadata
 */
export function listAllPrompts(): PromptTemplate[] {
  return ICN_PROMPTS.map(prompt => ({
    name: prompt.name,
    description: prompt.description,
    arguments: prompt.arguments,
    category: prompt.category,
    content: prompt.template,
  }));
}

/**
 * Get prompt metadata without the full template content
 */
export function getPromptMetadata(promptName: string): Omit<PromptTemplate, 'content'> | null {
  const prompt = getPromptByName(promptName);
  if (!prompt) {
    return null;
  }
  
  return {
    name: prompt.name,
    description: prompt.description,
    arguments: prompt.arguments,
    category: prompt.category,
  };
}