import { z } from 'zod';

// Values you can interpolate into templates
export type TemplateScalar = string | number | boolean;

// Context available to the template engine.
// We give it an index signature so keyed access is type-safe.
export interface TemplateVars {
  currentDate: string;
  [key: string]: TemplateScalar;
}

// Generic prompt arguments from callers (validated by Zod)
export const PromptArgsSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

export type PromptArgs = z.infer<typeof PromptArgsSchema>;

/**
 * Schema for prompt argument definitions
 */
export const PromptArgumentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  required: z.boolean().optional().default(false),
});

/**
 * Schema for ICN prompt templates  
 */
export const ICNPromptSchema = z.object({
  name: z.string(),
  description: z.string(),
  arguments: z.array(PromptArgumentSchema).optional().default([]),
  category: z.enum(['workflow', 'documentation', 'review', 'governance']),
  template: z.string(),
});

export type ICNPromptArgument = z.infer<typeof PromptArgumentSchema>;
export type ICNPrompt = z.infer<typeof ICNPromptSchema>;

/**
 * Prompt template with interpolated values
 */
export interface PromptTemplate {
  name: string;
  description: string;
  arguments: ICNPromptArgument[];
  category: 'workflow' | 'documentation' | 'review' | 'governance';
  content: string;
}